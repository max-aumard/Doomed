import FamilyControls
import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var blocker: AppBlocker
    @State private var showPicker = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Masquer les Reels", isOn: $model.settings.hideReels)
                    Toggle("Masquer Explorer", isOn: $model.settings.hideExplore)
                    Toggle("Masquer le fil d'accueil", isOn: $model.settings.hideHomeFeed)
                } header: {
                    Text("Instagram")
                } footer: {
                    Text("Les messages restent accessibles. Un reel envoyé par un ami s'ouvre seul, sans pouvoir swiper vers le suivant.")
                }

                Section {
                    Toggle("Masquer les Shorts", isOn: $model.settings.hideShorts)
                } header: {
                    Text("YouTube")
                } footer: {
                    Text("Un lien Short s'ouvre dans le lecteur classique.")
                }

                Section {
                    if blocker.isAuthorized {
                        Button {
                            showPicker = true
                        } label: {
                            LabeledContent("Apps à bloquer", value: "\(blocker.selectedAppCount)")
                        }
                        Toggle("Bloquer les apps natives", isOn: $blocker.isEnabled)
                            .disabled(blocker.selectedAppCount == 0)
                    } else {
                        Button("Autoriser Screen Time") {
                            Task { await blocker.requestAuthorization() }
                        }
                    }
                    if let message = blocker.errorMessage {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                } header: {
                    Text("Blocage des apps officielles")
                } footer: {
                    Text("Choisis uniquement les apps Instagram et YouTube (pas de catégories ni de sites web), sinon Doomed se bloquerait lui-même. Les notifications des apps bloquées continuent d'arriver.")
                }
            }
            .navigationTitle("Réglages")
            .familyActivityPicker(isPresented: $showPicker, selection: $blocker.selection)
            .onAppear { blocker.refreshAuthorization() }
        }
    }
}
