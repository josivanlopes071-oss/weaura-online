/**
 * Algoritmo Avançado de Processamento de Imagens para Molduras WePlay Aura.
 * Processa imagens em tempo real usando HTML5 Canvas para remover qualquer
 * fundo (preto, branco ou cinza) e manter transparência Alfa (RGBA) pura.
 */

const processedCache: { [url: string]: string } = {};

/**
 * Converte qualquer imagem remota do Google Drive em uma Data URL PNG transparente.
 * Bypassa erros de CORS utilizando cache buster e cabeçalhos apropriados.
 */
export async function getTransparentFrame(url: string): Promise<string> {
  if (!url) return '';
  if (processedCache[url]) {
    return processedCache[url];
  }

  return new Promise((resolve) => {
    const img = new Image();
    
    // Ativa CORS. Para evitar problemas de cache de imagem prévia sem CORS,
    // adicionamos um parâmetro de cache buster único.
    img.crossOrigin = 'anonymous';
    const cacheBuster = `cors-safe-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    img.src = url.includes('?') ? `${url}&nocache=${cacheBuster}` : `${url}?nocache=${cacheBuster}`;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(url);
          return;
        }

        const size = Math.max(img.width, img.height);
        // Garante dimensão quadrada perfeita sem corte das pontas
        canvas.width = size;
        canvas.height = size;

        // Centraliza a imagem no canvas quadrado
        const dx = (size - img.width) / 2;
        const dy = (size - img.height) / 2;

        ctx.drawImage(img, dx, dy, img.width, img.height);

        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;

        // Limiar de tolerância para detecção de fundos indesejados
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue; // Pula transperências nativas

          // 1. Detectar fundo preto/escuro fundo WePlay clássico de exportação
          const isBlackBackground = r < 55 && g < 55 && b < 55;

          // 2. Detectar fundo branco clássico
          const isWhiteBackground = r > 215 && g > 215 && b > 215;

          // 3. Detectar tons de cinza do fundo de caixas
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const rgbDiff = maxVal - minVal;
          const avgVal = (r + g + b) / 3;
          
          // Cinza neutro: variação cromática baixa e brilho intermediário
          const isGrayBackground = rgbDiff < 18 && avgVal > 40 && avgVal < 225;

          if (isBlackBackground || isWhiteBackground || isGrayBackground) {
            // Remove o pixel completamente
            data[i + 3] = 0;
          } else {
            // Suaviza as bordas do brilho neon para remover halos escuros/claros
            const edgeAlphaFactor = Math.min(
              (maxVal - 40) / 45, // Transição suave perto do preto
              (245 - minVal) / 35, // Transição suave perto do branco
              rgbDiff / 12         // Transição suave para cores dessaturadas
            );

            if (edgeAlphaFactor < 1) {
              const multiplier = Math.max(0, edgeAlphaFactor);
              data[i + 3] = Math.round(multiplier * data[i + 3]);
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        
        try {
          const processedUrl = canvas.toDataURL('image/png', 1.0);
          processedCache[url] = processedUrl;
          resolve(processedUrl);
        } catch (err) {
          console.warn("[FrameProcessor] Falha no Canvas toDataURL (restrição de segurança):", err);
          resolve(url); // Fallback amigável
        }
      } catch (err) {
        console.warn("[FrameProcessor] Erro na filtragem de pixels:", err);
        resolve(url);
      }
    };

    img.onerror = () => {
      console.warn("[FrameProcessor] Erro ao carregar recurso da moldura em cache buster:", url);
      resolve(url); // Fallback para a URL normal
    };
  });
}
