import SwiftUI
import UIKit
import WebKit

struct WebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// Owns one long-lived WKWebView per site so switching sites keeps their state.
@MainActor
final class WebViewStore: NSObject, ObservableObject {
    let site: Site
    let webView: WKWebView

    /// Page color used to paint the status bar strip above the web view.
    @Published private(set) var topColor: UIColor = .systemBackground

    private var settings: FilterSettings
    private var adRules: WKContentRuleList?
    private var started = false
    private var colorObservers: [NSKeyValueObservation] = []

    private static let filterSource: String = {
        guard
            let url = Bundle.main.url(forResource: "filter", withExtension: "js"),
            let source = try? String(contentsOf: url, encoding: .utf8)
        else {
            assertionFailure("filter.js missing from bundle")
            return ""
        }
        return source
    }()

    init(site: Site, settings: FilterSettings) {
        self.site = site
        self.settings = settings

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // keeps the login between launches
        config.allowsInlineMediaPlayback = true
        // Look like mobile Safari so sites serve their normal mobile web version.
        config.applicationNameForUserAgent = "Version/17.0 Mobile/15E148 Safari/604.1"

        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(pullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        installScripts()

        colorObservers = [
            webView.observe(\.themeColor, options: [.new]) { [weak self] _, _ in
                DispatchQueue.main.async { self?.updateTopColor() }
            },
            webView.observe(\.underPageBackgroundColor, options: [.new]) { [weak self] _, _ in
                DispatchQueue.main.async { self?.updateTopColor() }
            },
        ]
    }

    private func updateTopColor() {
        let color: UIColor? = webView.themeColor ?? webView.underPageBackgroundColor
        topColor = color ?? .systemBackground
    }

    /// Called once the ad-block rule list is compiled (or failed to compile).
    func start(adRules: WKContentRuleList?) {
        self.adRules = adRules
        installContentRules()
        guard !started else { return }
        started = true
        goHome()
    }

    func apply(_ settings: FilterSettings) {
        self.settings = settings
        installScripts()
        installContentRules()
        webView.reload()
    }

    func goHome() {
        webView.load(URLRequest(url: site.homeURL))
    }

    private func installScripts() {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        controller.addUserScript(WKUserScript(
            source: "window.__DOOMED_CONFIG__ = \(settings.json);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        controller.addUserScript(WKUserScript(
            source: Self.filterSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
    }

    private func installContentRules() {
        let controller = webView.configuration.userContentController
        controller.removeAllContentRuleLists()
        if settings.blockAds, let adRules {
            controller.add(adRules)
        }
    }

    @objc private func pullToRefresh(_ sender: UIRefreshControl) {
        webView.reload()
        sender.endRefreshing()
    }
}

extension WebViewStore: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            return .allow
        }

        if ["about", "blob", "data"].contains(scheme) {
            return .allow
        }

        // instagram://, youtube://, itms-apps:// ... would leave the filtered view
        // and open the native app (which is exactly what we want to avoid).
        guard scheme == "http" || scheme == "https" else {
            return .cancel
        }

        // Sub-frames (ads, embeds, login iframes) are not our business.
        guard navigationAction.targetFrame?.isMainFrame ?? true else {
            return .allow
        }

        if site.allows(host: url.host) {
            return .allow
        }

        // External link: open it in Safari instead of inside the wrapper.
        _ = await UIApplication.shared.open(url)
        return .cancel
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

extension WebViewStore: WKUIDelegate {
    /// target="_blank" links: load them in the same view instead of dropping them.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    /// Microphone / camera for voice messages and video calls. iOS still shows
    /// its own system prompt the first time (NSMicrophoneUsageDescription).
    func webView(
        _ webView: WKWebView,
        decideMediaCapturePermissionsFor origin: WKSecurityOrigin,
        initiatedBy frame: WKFrameInfo,
        type: WKMediaCaptureType
    ) async -> WKPermissionDecision {
        site.allows(host: origin.host) ? .grant : .deny
    }
}
