import AnimatedGridBackdrop from './AnimatedGridBackdrop';

export default function AnimatedGridBackdropExample() {
  // Generate array of image paths from the grid-images folder
  const images = Array.from({ length: 43 }, (_, i) => `/grid-images/${i + 1}.jpg`);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AnimatedGridBackdrop images={images.slice(0, 9)} gridLayout="layout-1" />
      
      {/* Your content goes here */}
      <div style={{ position: 'relative', zIndex: 10, padding: '2rem' }}>
        <h1>Your Content Here</h1>
        <p>This is overlaid on top of the animated grid backdrop.</p>
      </div>
    </div>
  );
}
