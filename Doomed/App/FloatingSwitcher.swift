import SwiftUI
import UIKit

/// A small translucent bubble stuck to a screen edge (draggable).
/// Tap it to open a mini menu: Instagram / YouTube / Settings.
struct FloatingSwitcher: View {
    let current: Site
    let onSelect: (Site) -> Void
    let onSettings: () -> Void

    @AppStorage("bubbleY") private var bubbleY = 0.7
    @AppStorage("bubbleOnRight") private var onRight = true
    @State private var expanded = false
    @GestureState private var dragOffset: CGSize = .zero

    private let bubble: CGFloat = 38
    private let item: CGFloat = 44
    private let margin: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            let center = anchor(in: geo.size)
            let x = center.x
            let y = center.y

            ZStack {
                if expanded {
                    // Tap anywhere else to close the menu.
                    Color.black.opacity(0.001)
                        .ignoresSafeArea()
                        .onTapGesture { setExpanded(false) }
                }

                Group {
                    if expanded { menu } else { collapsed }
                }
                .position(
                    x: x + (expanded ? 0 : dragOffset.width),
                    y: y + (expanded ? 0 : dragOffset.height)
                )
                .gesture(
                    DragGesture(minimumDistance: 6)
                        .updating($dragOffset) { value, state, _ in state = value.translation }
                        .onEnded { value in
                            onRight = x + value.translation.width > geo.size.width / 2
                            bubbleY = Double((y + value.translation.height) / geo.size.height)
                        },
                    including: expanded ? .subviews : .all
                )
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: expanded)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: onRight)
    }

    /// Center of the bubble (or of the open menu), kept inside the screen.
    private func anchor(in size: CGSize) -> CGPoint {
        let rows = CGFloat(Site.allCases.count + 1)
        let width: CGFloat = expanded ? item + 8 : bubble
        let height: CGFloat = expanded ? rows * item + 8 : bubble
        let x: CGFloat = onRight ? size.width - width / 2 - margin : width / 2 + margin
        let wanted = CGFloat(bubbleY) * size.height
        let low: CGFloat = height / 2 + 8
        let high: CGFloat = size.height - height / 2 - 8
        let y: CGFloat = min(max(wanted, low), high)
        return CGPoint(x: x, y: y)
    }

    private var collapsed: some View {
        Image(systemName: current.icon)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.primary)
            .frame(width: bubble, height: bubble)
            .background(.ultraThinMaterial, in: Circle())
            .overlay(Circle().strokeBorder(.primary.opacity(0.08)))
            .opacity(0.6)
            .contentShape(Circle())
            .onTapGesture { setExpanded(true) }
            .accessibilityLabel("Changer de site")
            .accessibilityAddTraits(.isButton)
    }

    private var menu: some View {
        VStack(spacing: 0) {
            ForEach(Site.allCases) { site in
                menuButton(icon: site.icon, label: site.title, selected: site == current) {
                    onSelect(site)
                }
            }
            menuButton(icon: "gearshape.fill", label: "Réglages", selected: false) {
                onSettings()
            }
        }
        .padding(4)
        .background(.regularMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.25), radius: 10, y: 4)
    }

    private func menuButton(icon: String, label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            setExpanded(false)
            action()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(selected ? Color.accentColor : Color.primary)
                .frame(width: item, height: item)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func setExpanded(_ value: Bool) {
        expanded = value
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
