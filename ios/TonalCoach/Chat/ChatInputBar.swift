import PhotosUI
import SwiftUI

// MARK: - Chat Input Bar

/// Bottom input bar for composing and sending messages to the coach.
///
/// Features:
/// - Multiline text field (up to 5 lines)
/// - Image attachment via PhotosPicker (max 4 images)
/// - Image preview row with remove buttons
/// - Send button with loading state
/// - Keyboard-aware via SwiftUI safe area
struct ChatInputBar: View {
    let viewModel: ChatViewModel
    @Environment(\.convexManager) private var convex

    @State private var text = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @FocusState private var isTextFieldFocused: Bool

    private var canSend: Bool {
        let hasText = !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasImages = !viewModel.pendingImages.isEmpty
        return (hasText || hasImages) && !viewModel.isSending
    }

    var body: some View {
        VStack(spacing: 0) {
            // Top border
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: 0.5)

            VStack(spacing: Theme.Spacing.sm) {
                // Image preview row
                if !viewModel.pendingImages.isEmpty {
                    imagePreviewRow
                }

                // Input row
                HStack(alignment: .bottom, spacing: 4) {
                    // Attachment button
                    PhotosPicker(
                        selection: $selectedPhotos,
                        maxSelectionCount: 4 - viewModel.pendingImages.count,
                        matching: .images,
                        photoLibrary: .shared()
                    ) {
                        Image(systemName: "paperclip")
                            .font(.system(size: 18))
                            .foregroundStyle(
                                viewModel.pendingImages.count >= 4
                                    ? Theme.Colors.textTertiary
                                    : Theme.Colors.textSecondary
                            )
                            .frame(width: 36, height: 36)
                            .contentShape(Rectangle())
                    }
                    .disabled(viewModel.isSending || viewModel.pendingImages.count >= 4)
                    .accessibilityLabel("Attach images")
                    .accessibilityHint(
                        viewModel.pendingImages.count >= 4
                            ? "Maximum 4 images reached"
                            : "Opens photo picker"
                    )

                    // Text field with background
                    TextField("Message your coach...", text: $text, axis: .vertical)
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .lineLimit(1...5)
                        .focused($isTextFieldFocused)
                        .disabled(viewModel.isSending)
                        .submitLabel(.send)
                        .onSubmit { send() }
                        .padding(.horizontal, Theme.Spacing.md)
                        .padding(.vertical, Theme.Spacing.sm)
                        .background(Theme.Colors.background)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(
                                    isTextFieldFocused ? Theme.Colors.primary.opacity(0.3) : Color.white.opacity(0.08),
                                    lineWidth: 1
                                )
                                .animation(.easeInOut(duration: 0.2), value: isTextFieldFocused)
                        )
                        .accessibilityLabel("Message input")

                    // Send button
                    Button(action: send) {
                        Group {
                            if viewModel.isSending || viewModel.isUploadingImages {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(Theme.Colors.primary)
                            } else {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.system(size: 30))
                                    .foregroundStyle(
                                        canSend
                                            ? Theme.Colors.primary
                                            : Theme.Colors.textTertiary
                                    )
                            }
                        }
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                    }
                    .scaleEffect(canSend ? 1.0 : 0.9)
                    .animation(Animate.snappy, value: canSend)
                    .disabled(!canSend)
                    .accessibilityLabel(
                        viewModel.isSending
                            ? "Sending message"
                            : "Send message"
                    )
                }
            }
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.top, Theme.Spacing.sm)
            .padding(.bottom, Theme.Spacing.xs)
        }
        .background(Theme.Colors.card)
        .onChange(of: selectedPhotos) { _, newItems in
            handlePhotoSelection(newItems)
        }
    }

    // MARK: - Image Preview Row

    private var imagePreviewRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(
                    Array(viewModel.pendingImages.enumerated()),
                    id: \.element.id
                ) { index, pending in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: pending.preview)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 64, height: 64)
                            .clipShape(
                                RoundedRectangle(
                                    cornerRadius: Theme.CornerRadius.md,
                                    style: .continuous
                                )
                            )

                        // Remove button
                        Button {
                            withAnimation(.easeOut(duration: 0.15)) {
                                viewModel.removeImage(at: index)
                            }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 18))
                                .foregroundStyle(Theme.Colors.textPrimary)
                                .background(
                                    Circle()
                                        .fill(Theme.Colors.background)
                                        .frame(width: 16, height: 16)
                                )
                        }
                        .offset(x: 4, y: -4)
                        .accessibilityLabel("Remove image \(index + 1)")
                    }
                }

                // Upload indicator
                if viewModel.isUploadingImages {
                    RoundedRectangle(
                        cornerRadius: Theme.CornerRadius.md,
                        style: .continuous
                    )
                    .fill(Theme.Colors.muted)
                    .frame(width: 64, height: 64)
                    .overlay(
                        ProgressView()
                            .controlSize(.small)
                            .tint(Theme.Colors.textTertiary)
                    )
                    .accessibilityLabel("Uploading images")
                }
            }
            .padding(.top, Theme.Spacing.xs)
        }
    }

    // MARK: - Actions

    private func send() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canSend else { return }

        Theme.Haptics.light()
        text = ""
        isTextFieldFocused = false

        Task {
            await viewModel.send(text: trimmed, using: convex)
        }
    }

    private func handlePhotoSelection(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }

        Task {
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    viewModel.addImage(data)
                }
            }
            // Reset selection so the same photos can be re-selected
            selectedPhotos = []
        }
    }
}
