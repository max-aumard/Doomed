import Foundation

enum Site: String, CaseIterable, Identifiable {
    case instagram
    case youtube

    var id: String { rawValue }

    var title: String {
        switch self {
        case .instagram: return "Instagram"
        case .youtube: return "YouTube"
        }
    }

    var icon: String {
        switch self {
        case .instagram: return "bubble.left.and.bubble.right.fill"
        case .youtube: return "play.rectangle.fill"
        }
    }

    var homeURL: URL {
        switch self {
        case .instagram: return URL(string: "https://www.instagram.com/direct/inbox/")!
        case .youtube: return URL(string: "https://m.youtube.com/")!
        }
    }

    /// Hosts allowed to load in the main frame. Anything else opens in Safari.
    func allows(host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }
        func matches(_ domain: String) -> Bool {
            host == domain || host.hasSuffix("." + domain)
        }
        switch self {
        case .instagram:
            // facebook.com is needed for "Log in with Facebook".
            return ["instagram.com", "facebook.com"].contains(where: matches)
        case .youtube:
            if ["youtube.com", "youtu.be", "google.com", "gstatic.com"].contains(where: matches) {
                return true
            }
            // Google sign-in / consent on country domains (google.fr, google.co.uk, ...).
            return host.range(of: #"(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$"#, options: .regularExpression) != nil
        }
    }
}
