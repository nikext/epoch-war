import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/russo-one/400.css';
import './ui/styles.css';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('scene') as HTMLCanvasElement;

if (import.meta.env.DEV && params.has('gallery')) {
  void import('./dev/gallery').then((m) => m.runGallery(canvas, params));
} else {
  void import('./game').then((m) => m.boot(canvas, params));
}
