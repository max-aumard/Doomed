import FamilyControls
import Foundation
import ManagedSettings

/// Puts a Screen Time shield on the native apps the user picks (Instagram, YouTube...).
/// Without this, the user can simply reopen the official app and scroll.
@MainActor
final class AppBlocker: ObservableObject {
    private enum Keys {
        static let selection = "blockSelection"
        static let enabled = "blockEnabled"
    }

    @Published private(set) var isAuthorized = false
    @Published var errorMessage: String?

    @Published var selection: FamilyActivitySelection {
        didSet {
            saveSelection()
            if isEnabled { applyShield() }
        }
    }

    @Published var isEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isEnabled, forKey: Keys.enabled)
            if isEnabled { applyShield() } else { clearShield() }
        }
    }

    private let store = ManagedSettingsStore()

    init() {
        if
            let data = UserDefaults.standard.data(forKey: Keys.selection),
            let saved = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
        {
            _selection = Published(initialValue: saved)
        } else {
            _selection = Published(initialValue: FamilyActivitySelection())
        }
        _isEnabled = Published(initialValue: UserDefaults.standard.bool(forKey: Keys.enabled))
        refreshAuthorization()
    }

    var selectedAppCount: Int { selection.applicationTokens.count }

    func refreshAuthorization() {
        isAuthorized = AuthorizationCenter.shared.authorizationStatus == .approved
    }

    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            errorMessage = nil
        } catch {
            // The most common cause: the build was re-signed by a sideloading tool
            // that drops the com.apple.developer.family-controls entitlement.
            errorMessage = """
            Screen Time indisponible (\(error.localizedDescription)). \
            Si l'app a été installée avec Sideloadly, installe la version signée \
            « Doomed-dev » (voir README).
            """
        }
        refreshAuthorization()
    }

    private func applyShield() {
        guard isAuthorized else { return }
        // Apps only: shielding categories or web domains could also block
        // instagram.com / youtube.com inside Doomed itself.
        let apps = selection.applicationTokens
        store.shield.applications = apps.isEmpty ? nil : apps
    }

    private func clearShield() {
        store.clearAllSettings()
    }

    private func saveSelection() {
        if let data = try? JSONEncoder().encode(selection) {
            UserDefaults.standard.set(data, forKey: Keys.selection)
        }
    }
}
