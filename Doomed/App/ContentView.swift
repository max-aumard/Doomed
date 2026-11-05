import SwiftUI

/// Full-screen site, no browser chrome. A small floating bubble switches sites.
struct ContentView: View {
    @EnvironmentObject private var model: AppModel
    @AppStorage("currentSite") private var currentRaw = Site.instagram.rawValue
    @State private var showSettings = false

    private var current: Site { Site(rawValue: currentRaw) ?? .instagram }

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()

            ForEach(Site.allCases) { site in
                SitePage(store: model.store(for: site))
                    .opacity(site == current ? 1 : 0)
                    .allowsHitTesting(site == current)
                    .accessibilityHidden(site != current)
            }

            FloatingSwitcher(
                current: current,
                onSelect: select,
                onSettings: { showSettings = true }
            )
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
    }

    private func select(_ site: Site) {
        if site == current {
            // Tapping the site you're already on goes back to its home page.
            model.store(for: site).goHome()
        } else {
            currentRaw = site.rawValue
        }
    }
}

/// The web view stays below the status bar (sites' fixed headers would
/// otherwise sit under the clock); the strip above is painted with the page color.
private struct SitePage: View {
    @ObservedObject var store: WebViewStore

    var body: some View {
        WebView(webView: store.webView)
            .ignoresSafeArea(.container, edges: .bottom)
            .background(Color(uiColor: store.topColor).ignoresSafeArea())
    }
}
