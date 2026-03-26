import SwiftUI
import UIKit

// MARK: - Image Viewer Overlay

/// Fullscreen image viewer with pinch-to-zoom and swipe-to-dismiss.
/// Presented as a `.fullScreenCover` from `MessageBubble` when a chat image is tapped.
struct ImageViewerOverlay: View {
    let url: URL
    let onDismiss: () -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var isDragging = false

    private var backgroundOpacity: Double {
        0.9 * (1 - abs(dragOffset) / 400)
    }

    private var imageScale: CGFloat {
        1 - abs(dragOffset) / 2000
    }

    var body: some View {
        ZStack {
            Color.black
                .opacity(backgroundOpacity)
                .ignoresSafeArea()

            ZoomableImageView(url: url)
                .scaleEffect(imageScale)
                .offset(y: dragOffset)
                .gesture(dismissDrag)

            closeButton
        }
        .background(ClearBackground())
        .statusBarHidden(true)
    }

    // MARK: - Close Button

    private var closeButton: some View {
        VStack {
            HStack {
                Spacer()
                Button(action: dismissWithHaptic) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                }
                .padding(.trailing, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.sm)
            }
            Spacer()
        }
        .opacity(isDragging ? 0.3 : 1)
    }

    // MARK: - Drag Gesture

    private var dismissDrag: some Gesture {
        DragGesture()
            .onChanged { value in
                isDragging = true
                dragOffset = value.translation.height
            }
            .onEnded { value in
                let velocity = abs(value.predictedEndTranslation.height - value.translation.height)
                let distance = abs(value.translation.height)

                if velocity > 500 || distance > 200 {
                    dismissWithHaptic()
                } else {
                    withAnimation(Animate.snappy) {
                        dragOffset = 0
                        isDragging = false
                    }
                }
            }
    }

    // MARK: - Dismiss

    private func dismissWithHaptic() {
        HapticEngine.tap()
        withAnimation(Animate.smooth) {
            dragOffset = 600
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            onDismiss()
        }
    }
}

// MARK: - Clear Background

/// Removes the default white/system background from `.fullScreenCover`.
private struct ClearBackground: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        DispatchQueue.main.async {
            view.superview?.superview?.backgroundColor = .clear
        }
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

// MARK: - Zoomable Image View

/// UIKit-backed scroll view that provides native pinch-to-zoom and double-tap zoom toggle.
/// Uses `UIScrollView` for smooth, physics-based zoom (SwiftUI `MagnificationGesture` is too limited).
struct ZoomableImageView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.delegate = context.coordinator
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 5.0
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.bouncesZoom = true
        scrollView.backgroundColor = .clear

        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.clipsToBounds = true
        imageView.backgroundColor = .clear
        scrollView.addSubview(imageView)
        context.coordinator.imageView = imageView

        let doubleTap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleDoubleTap(_:))
        )
        doubleTap.numberOfTapsRequired = 2
        scrollView.addGestureRecognizer(doubleTap)
        context.coordinator.scrollView = scrollView

        loadImage(into: imageView, scrollView: scrollView)

        return scrollView
    }

    func updateUIView(_ scrollView: UIScrollView, context: Context) {}

    // MARK: - Image Loading

    private func loadImage(into imageView: UIImageView, scrollView: UIScrollView) {
        let task = URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async {
                imageView.image = image
                layoutImageView(imageView, in: scrollView, imageSize: image.size)
            }
        }
        task.resume()
    }

    private func layoutImageView(
        _ imageView: UIImageView,
        in scrollView: UIScrollView,
        imageSize: CGSize
    ) {
        let bounds = scrollView.bounds
        guard bounds.width > 0, bounds.height > 0 else { return }

        let widthRatio = bounds.width / imageSize.width
        let heightRatio = bounds.height / imageSize.height
        let fitScale = min(widthRatio, heightRatio)

        let fitWidth = imageSize.width * fitScale
        let fitHeight = imageSize.height * fitScale

        imageView.frame = CGRect(
            x: (bounds.width - fitWidth) / 2,
            y: (bounds.height - fitHeight) / 2,
            width: fitWidth,
            height: fitHeight
        )
        scrollView.contentSize = CGSize(width: fitWidth, height: fitHeight)
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, UIScrollViewDelegate {
        weak var imageView: UIImageView?
        weak var scrollView: UIScrollView?

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            imageView
        }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            centerImageView(in: scrollView)
        }

        @objc func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            guard let scrollView else { return }

            if scrollView.zoomScale > scrollView.minimumZoomScale {
                scrollView.setZoomScale(1.0, animated: true)
            } else {
                let location = gesture.location(in: scrollView.subviews.first)
                let zoomRect = zoomRectForScale(2.5, center: location, in: scrollView)
                scrollView.zoom(to: zoomRect, animated: true)
            }
        }

        private func centerImageView(in scrollView: UIScrollView) {
            guard let imageView else { return }
            let boundsSize = scrollView.bounds.size
            var frameToCenter = imageView.frame

            if frameToCenter.size.width < boundsSize.width {
                frameToCenter.origin.x = (boundsSize.width - frameToCenter.size.width) / 2
            } else {
                frameToCenter.origin.x = 0
            }

            if frameToCenter.size.height < boundsSize.height {
                frameToCenter.origin.y = (boundsSize.height - frameToCenter.size.height) / 2
            } else {
                frameToCenter.origin.y = 0
            }

            imageView.frame = frameToCenter
        }

        private func zoomRectForScale(
            _ scale: CGFloat,
            center: CGPoint,
            in scrollView: UIScrollView
        ) -> CGRect {
            let size = CGSize(
                width: scrollView.bounds.width / scale,
                height: scrollView.bounds.height / scale
            )
            let origin = CGPoint(
                x: center.x - size.width / 2,
                y: center.y - size.height / 2
            )
            return CGRect(origin: origin, size: size)
        }
    }
}
