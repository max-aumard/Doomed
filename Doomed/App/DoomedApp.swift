import SwiftUI

@main
struct DoomedApp: App {
    @StateObject private var model = AppModel()
    @StateObject private var blocker = AppBlocker()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .environmentObject(blocker)
        }
    }
}
