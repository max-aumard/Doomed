import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        TabView {
            SiteView(store: model.instagram)
                .tabItem { Label("Instagram", systemImage: "bubble.left.and.bubble.right") }

            SiteView(store: model.youtube)
                .tabItem { Label("YouTube", systemImage: "play.rectangle") }

            SettingsView()
                .tabItem { Label("Réglages", systemImage: "gearshape") }
        }
    }
}
