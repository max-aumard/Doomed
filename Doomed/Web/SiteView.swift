import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// One site tab: a thin toolbar above the filtered web view.
struct SiteView: View {
    @ObservedObject var store: WebViewStore

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 20) {
                Button(action: store.goBack) {
                    Image(systemName: "chevron.left")
                }
                .disabled(!store.canGoBack)
                .accessibilityLabel("Retour")

                Spacer()

                Text(store.site.title)
                    .font(.headline)

                Spacer()

                Button(action: store.goHome) {
                    Image(systemName: "house")
                }
                .accessibilityLabel("Accueil")

                Button(action: store.reload) {
                    if store.isLoading {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                .accessibilityLabel("Recharger")
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(.bar)

            Divider()

            WebView(webView: store.webView)
        }
    }
}
