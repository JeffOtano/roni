#!/usr/bin/env swift

// Generates the TonalCoach app icon as a 1024x1024 PNG.
// Matches the web app's apple-icon.tsx: "tc" lettermark in DM Sans Bold,
// teal (#00cacb) on dark background (#0a0a0a), with rounded corners.

import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let cgSize = CGSize(width: size, height: size)

// Brand colors (matching apple-icon.tsx)
let bgRed: CGFloat = 0x0A / 255.0
let bgGreen: CGFloat = 0x0A / 255.0
let bgBlue: CGFloat = 0x0A / 255.0

let fgRed: CGFloat = 0x00 / 255.0
let fgGreen: CGFloat = 0xCA / 255.0
let fgBlue: CGFloat = 0xCB / 255.0

// Create bitmap context
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
    data: nil,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: size * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    print("ERROR: Failed to create CGContext")
    exit(1)
}

// Fill background (dark, near-black)
context.setFillColor(red: bgRed, green: bgGreen, blue: bgBlue, alpha: 1.0)
context.fill(CGRect(origin: .zero, size: cgSize))

// Load DM Sans Bold font from the project
let fontPath = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "src/app/fonts/DMSans-Bold.ttf"

let fontURL = URL(fileURLWithPath: fontPath)
guard let fontDataProvider = CGDataProvider(url: fontURL as CFURL),
      let cgFont = CGFont(fontDataProvider) else {
    print("ERROR: Failed to load font from \(fontPath)")
    exit(1)
}

// Register the font
var error: Unmanaged<CFError>?
CTFontManagerRegisterGraphicsFont(cgFont, &error)
if let error = error {
    print("WARNING: Font registration error (may already be registered): \(error.takeRetainedValue())")
}

// Create CTFont at the right size
// The web icon uses fontSize 100 for a 180x180 icon = 55.6% of icon size
// For 1024x1024: 1024 * 0.556 = 569, but let's match the visual weight
// Web: 100px font in 180px canvas. Scale: 1024/180 * 100 = 569
let fontSize: CGFloat = 569.0
let ctFont = CTFontCreateWithGraphicsFont(cgFont, fontSize, nil, nil)

// Set up the attributed string "tc"
let text = "tc" as CFString
let attributes: [CFString: Any] = [
    kCTFontAttributeName: ctFont,
    kCTForegroundColorFromContextAttributeName: true
]
let attrString = CFAttributedStringCreate(nil, text, attributes as CFDictionary)!
let line = CTLineCreateWithAttributedString(attrString)

// Get text bounds for centering
let textBounds = CTLineGetBoundsWithOptions(line, .useOpticalBounds)

// Center the text in the canvas
// The web icon uses letterSpacing: -3px. At our scale: -3 * (1024/180) = -17
let letterSpacingAdjust: CGFloat = -17.0
let textWidth = textBounds.width + letterSpacingAdjust
let xPos = (CGFloat(size) - textWidth) / 2.0 - textBounds.origin.x
// Vertically center: account for descender
let yPos = (CGFloat(size) - textBounds.height) / 2.0 - textBounds.origin.y

// Draw the text
context.saveGState()
context.setFillColor(red: fgRed, green: fgGreen, blue: fgBlue, alpha: 1.0)

// Apply letter spacing by drawing characters individually
let tAttrString = CFAttributedStringCreate(nil, "t" as CFString, attributes as CFDictionary)!
let cAttrString = CFAttributedStringCreate(nil, "c" as CFString, attributes as CFDictionary)!
let tLine = CTLineCreateWithAttributedString(tAttrString)
let cLine = CTLineCreateWithAttributedString(cAttrString)

let tBounds = CTLineGetBoundsWithOptions(tLine, .useOpticalBounds)
let cBounds = CTLineGetBoundsWithOptions(cLine, .useOpticalBounds)

// Total width with letter spacing
let totalWidth = tBounds.width + letterSpacingAdjust + cBounds.width
let startX = (CGFloat(size) - totalWidth) / 2.0

// Vertical center
let maxHeight = max(tBounds.height, cBounds.height)
let baselineY = (CGFloat(size) - maxHeight) / 2.0 - min(tBounds.origin.y, cBounds.origin.y)

// Draw "t"
context.textPosition = CGPoint(x: startX - tBounds.origin.x, y: baselineY)
CTLineDraw(tLine, context)

// Draw "c" with letter spacing offset
let cX = startX - tBounds.origin.x + tBounds.width + letterSpacingAdjust + tBounds.origin.x - cBounds.origin.x
context.textPosition = CGPoint(x: cX, y: baselineY)
CTLineDraw(cLine, context)

context.restoreGState()

// Generate image
guard let cgImage = context.makeImage() else {
    print("ERROR: Failed to create image")
    exit(1)
}

// Write PNG
let outputPath = CommandLine.arguments.count > 2
    ? CommandLine.arguments[2]
    : "ios/TonalCoach/Assets.xcassets/AppIcon.appiconset/AppIcon.png"

let outputURL = URL(fileURLWithPath: outputPath)
guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    "public.png" as CFString,
    1,
    nil
) else {
    print("ERROR: Failed to create image destination at \(outputPath)")
    exit(1)
}

CGImageDestinationAddImage(destination, cgImage, nil)
guard CGImageDestinationFinalize(destination) else {
    print("ERROR: Failed to write PNG")
    exit(1)
}

print("SUCCESS: Generated \(size)x\(size) app icon at \(outputPath)")
