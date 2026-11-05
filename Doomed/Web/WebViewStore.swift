import UIKit
import WebKit

/// Owns one long-lived WKWebView per site so tabs keep their state.
@MainActor
final class WebViewStore: NSObject, ObservableObject {
    let site: Site
    let webView: WKWebView

    @Published private(set) var canGoBack = false
    @Published private(set) var isLoading = false

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

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(pullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        installScripts(settings)
        goHome()
    }

    func apply(_ settings: FilterSettings) {
        installScripts(settings)
        webView.reload()
    }

    func goHome() {
        webView.load(URLRequest(url: site.homeURL))
    }

    func goBack() {
        webView.goBack()
    }

    func reload() {
        webView.reload()
    }

    private func installScripts(_ settings: FilterSettings) {
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

    private func refreshState() {
        canGoBack = webView.canGoBack
        isLoading = webView.isLoading
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

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        refreshState()
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        refreshState()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshState()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        refreshState()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        refreshState()
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
}
