import Foundation

/// User-facing filter options. Serialized as JSON and handed to `filter.js`.
struct FilterSettings: Codable, Equatable {
    var hideReels = true
    var hideExplore = true
    var hideHomeFeed = false
    var hideShorts = true

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
    }
}
