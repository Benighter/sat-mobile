# Image Cropper Documentation

## Overview

The Image Cropper provides a flexible and user-friendly way to crop images in your React application. It includes support for preset aspect ratios, free-form cropping, and mobile-friendly touch interactions.

## Components

### 1. ImageUpload (Enhanced)
The main component that handles image upload with optional cropping functionality.

**Props:**
- `value?: string` - Base64 string of the current image
- `onChange: (base64: string | null) => void` - Callback when image changes
- `className?: string` - Additional CSS classes
- `size?: 'sm' | 'md' | 'lg'` - Size of the upload area
- `enableCropping?: boolean` - Enable cropping functionality (default: true)
- `cropPresets?: boolean` - Use preset cropper (default: true)

### 2. ImageCropper
Basic image cropper with free-form or fixed aspect ratio cropping.

**Props:**
- `image: string` - Base64 string of the image to crop
- `onCropComplete: (croppedImage: string) => void` - Callback with cropped image
- `onCancel: () => void` - Callback when user cancels
- `aspectRatio?: number` - Fixed aspect ratio (width/height), undefined for free crop

### 3. ImageCropperWithPresets
Enhanced cropper with preset aspect ratio options.

**Props:**
- `image: string` - Base64 string of the image to crop
- `onCropComplete: (croppedImage: string) => void` - Callback with cropped image
- `onCancel: () => void` - Callback when user cancels

## Usage Examples

### Basic Profile Image Upload with Presets
```tsx
import ImageUpload from './components/ui/ImageUpload';

function ProfileForm() {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  return (
    <ImageUpload
      value={profileImage}
      onChange={setProfileImage}
      size="lg"
      enableCropping={true}
      cropPresets={true}
    />
  );
}
```

### Member Image with Free-form Cropping
```tsx
import ImageUpload from './components/ui/ImageUpload';

function MemberForm() {
  const [memberImage, setMemberImage] = useState<string | null>(null);

  return (
    <ImageUpload
      value={memberImage}
      onChange={setMemberImage}
      size="md"
      enableCropping={true}
      cropPresets={false}
    />
  );
}
```

### Simple Upload without Cropping
```tsx
import ImageUpload from './components/ui/ImageUpload';

function DocumentUpload() {
  const [document, setDocument] = useState<string | null>(null);

  return (
    <ImageUpload
      value={document}
      onChange={setDocument}
      enableCropping={false}
    />
  );
}
```

### Direct Cropper Usage
```tsx
import ImageCropper from './components/ui/ImageCropper';

function CustomCropper() {
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');

  const handleCropComplete = (croppedImage: string) => {
    console.log('Cropped image:', croppedImage);
    setShowCropper(false);
  };

  return (
    <>
      {showCropper && (
        <ImageCropper
          image={selectedImage}
          aspectRatio={1} // Square crop
          onCropComplete={handleCropComplete}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </>
  );
}
```

## Preset Aspect Ratios

The `ImageCropperWithPresets` component includes these preset options:

1. **Free** - Any size (no aspect ratio constraint)
2. **Square** - 1:1 ratio, perfect for profile pictures
3. **Portrait** - 3:4 ratio, mobile-friendly
4. **Landscape** - 16:9 ratio, widescreen format
5. **Profile** - 4:5 ratio, social media optimized

## Features

### Touch and Mouse Support
- Drag to move the crop area
- Resize using the corner handle
- Zoom in/out with buttons
- Touch-friendly for mobile devices

### Mobile Optimization
- Larger touch targets for mobile
- Touch event handling
- Responsive design
- Optimized for small screens

### Image Quality
- High-quality JPEG output (90% quality)
- Maintains original image resolution in cropped area
- Efficient canvas-based cropping

### User Experience
- Visual feedback during interactions
- Smooth animations and transitions
- Intuitive controls
- Cancel/apply options

## Integration with Existing Components

### MemberFormModal
The existing `MemberFormModal` already uses `ImageUpload` and will automatically get cropping functionality:

```tsx
<ImageUpload
  value={formData.profilePicture}
  onChange={handleImageChange}
  size="lg"
  // Cropping is enabled by default
/>
```

### ProfileSettingsView
Update the profile settings to use the enhanced ImageUpload:

```tsx
// Replace the existing image upload logic with:
<ImageUpload
  value={profileData.profilePicture}
  onChange={(base64) => setProfileData(prev => ({ ...prev, profilePicture: base64 || '' }))}
  size="lg"
  enableCropping={true}
  cropPresets={true}
/>
```

## Customization

### Custom Aspect Ratios
You can create custom aspect ratios by modifying the `aspectRatioPresets` array in `ImageCropperWithPresets.tsx`:

```tsx
const customPresets: AspectRatioPreset[] = [
  {
    name: 'Banner',
    ratio: 3/1,
    icon: <Monitor className="w-5 h-5" />,
    description: '3:1 - Banner format'
  },
  // ... other presets
];
```

### Styling
The components use Tailwind CSS classes and can be customized by:
- Modifying the existing classes
- Adding custom CSS classes via the `className` prop
- Overriding styles with CSS modules or styled-components

## Browser Support

- Modern browsers with Canvas API support
- Touch events for mobile devices
- File API for image reading
- Base64 encoding/decoding

## Performance Considerations

- Images are processed client-side using Canvas API
- Large images are handled efficiently
- 5MB file size limit (configurable)
- Optimized rendering for smooth interactions

## Troubleshooting

### Common Issues

1. **Image not loading**: Ensure the image is a valid format (JPEG, PNG, GIF, WebP)
2. **Touch not working**: Make sure `touch-none` class is applied to prevent default touch behavior
3. **Crop area outside image**: The component automatically constrains the crop area within image bounds
4. **Poor image quality**: Adjust the quality parameter in the `toDataURL` call

### Debug Mode
Add console logs to track image processing:

```tsx
const handleCropComplete = (croppedImage: string) => {
  console.log('Original image size:', selectedImage.length);
  console.log('Cropped image size:', croppedImage.length);
  console.log('Crop area:', cropArea);
};
```

## Future Enhancements

Potential improvements for future versions:
- Rotation functionality
- Multiple crop areas
- Batch processing
- Advanced filters
- Cloud-based processing
- Undo/redo functionality
