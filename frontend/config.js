// Backend público de EVOLVA. La clave de Gemini permanece únicamente en Render
const renderApi = 'https://evolva-jovenes-creativos.onrender.com';
window.EVOLVA_API_BASE = location.hostname.endsWith('.onrender.com')
  ? ''
  : renderApi;