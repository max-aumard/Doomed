import Foundation
import WebKit

/// User-facing filter options. Serialized as JSON and handed to `filter.js`.
struct FilterSettings: Codable, Equatable {
    var hideReels = true
    var hideExplore = true
    var hideHomeFeed = false
    var hideShorts = true
    var blockAds = true

    private static let key = "filterSettings"

    static func load() -> FilterSettings {
        guard
            let data = UserDefaults.standard.data(forKey: key),
            let settings = try? JSONDecoder().decode(FilterSettings.self, from: data)
        else { return FilterSettings() }
        return settings
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }

    var json: String {
        guard let data = try? JSONEncoder().encode(self) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}

@MainActor
final class AppModel: ObservableObject {
    let instagram: WebViewStore
    let youtube: WebViewStore

    @Published var settings: FilterSettings {
        didSet {
            guard settings != oldValue else { return }
            settings.save()
            instagram.apply(settings)
            youtube.apply(settings)
        }
    }

    init() {
        let settings = FilterSettings.load()
        self.settings = settings
        instagram = WebViewStore(site: .instagram, settings: settings)
        youtube = WebViewStore(site: .youtube, settings: settings)

        // Network-level ad blocking must be ready before the first page load.
        Task {
            let rules = await AdBlockRules.compile()
            instagram.start(adRules: rules)
            youtube.start(adRules: rules)
        }
    }

    func store(for site: Site) -> WebViewStore {
        switch site {
        case .instagram: return instagram
        case .youtube: return youtube
        }
    }
}

/// Compiles `adblock.json` (WebKit content blocker format) once.
enum AdBlockRules {
    static func compile() async -> WKContentRuleList? {
        guard
            let url = Bundle.main.url(forResource: "adblock", withExtension: "json"),
            let json = try? String(contentsOf: url, encoding: .utf8)
        else { return nil }

        return await withCheckedContinuation { continuation in
            WKContentRuleListStore.default().compileContentRuleList(
                forIdentifier: "doomed-adblock",
                encodedContentRuleList: json
            ) { list, error in
                if let error {
                    print("Doomed: ad-block rules failed to compile: \(error)")
                }
                continuation.resume(returning: list)
            }
        }
    }
}
