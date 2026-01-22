import express from 'express';
import multer from 'multer';
import type { Request, Response } from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const app = express();
const upload = multer({ dest: './uploads' });
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CREDENTIALS_PATH = './portraitchainsaw-e460097bd347.json';
const generatedUrls: Record<string, { sheetId: string; rangeMap: any; iconFile?: string }> = {};

async function getSheetData(sheetId: string, rangeMap: any) {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const ranges = [rangeMap.vidaAtual, rangeMap.vidaMax, rangeMap.peAtual, rangeMap.peMax];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges,
  });
  const valueRanges = res.data.valueRanges ?? [];
  const [vidaAtual, vidaMax, peAtual, peMax] = [0, 1, 2, 3].map(i => valueRanges[i]?.values?.[0]?.[0] || '0');
  return {
    vida: `${vidaAtual}/${vidaMax}`,
    pe: `${peAtual}/${peMax}`,
  };
}

app.post('/generate', upload.single('icon'), (req: Request, res: Response) => {
  const { sheetUrl } = req.body;
  const match = sheetUrl.match(/\/d\/(.*?)(\/|$)/);
  if (!match) return res.status(400).send('Invalid sheet URL');
  const sheetId = match[1];
  const id = uuidv4();
  // Map for the requested cells
  const rangeMap = {
    vidaAtual: 'O8',
    vidaMax: 'U8',
    peAtual: 'AC8',
    peMax: 'AI8',
  };
  let iconFile = undefined;
  if (req.file) {
    iconFile = req.file.filename;
  }
  generatedUrls[id] = { sheetId, rangeMap, iconFile };
  res.json({ url: `/status/${id}` });
});

app.get('/status/:id', async (req: Request, res: Response) => {
  let id = req.params.id;
  if (Array.isArray(id)) id = id[0];
  const entry = generatedUrls[id];
  if (!entry) return res.status(404).send('Not found');
  let iconUrl = '';
  if (entry.iconFile) {
    iconUrl = `/icon/${entry.iconFile}`;
  }

  // Se for ?json=1, retorna só os dados e encerra
  // eslint-disable-next-line
  // @ts-ignore
  if (req.query && req.query.json === '1') {
    try {
      const data = await getSheetData(entry.sheetId, entry.rangeMap);
      return res.json(data);
    } catch (e) {
      return res.status(500).send('Error fetching data');
    }
  }

  // Página com ícone octagonal rabiscado à esquerda das barras
  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            background: transparent;
            box-sizing: border-box;
            font-family: 'Segoe UI', Arial, sans-serif;
          }
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: transparent;
            gap: 24px;
          }
          .row {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .octa-icon {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .octa-svg {
            width: 48px;
            height: 48px;
            position: absolute;
            left: 0;
            top: 0;
            z-index: 2;
            pointer-events: none;
          }
          .octa-img {
            width: 40px;
            height: 40px;
            object-fit: cover;
            clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
            border-radius: 8px;
            position: relative;
            z-index: 1;
            background: #222;
          }
          .bar {
            width: 90vw;
            max-width: 400px;
            height: 32px;
            background: #0a0a0f;
            border-radius: 12px 32px 12px 32px/16px 32px 16px 32px;
            overflow: hidden;
            position: relative;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 0;
            filter: url(#scribble);
          }
          .fill {
            height: 100%;
            border-radius: 12px 0 0 12px;
            transition: width 0.5s cubic-bezier(.4,2,.3,1);
            position: absolute;
            left: 0;
            top: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.1em;
            color: #fff;
            text-shadow: 0 1px 4px #0008;
            width: 0;
            z-index: 1;
          }
          .bar .number {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.1em;
            color: #fff;
            text-shadow: 0 1px 4px #0008;
            z-index: 2;
            pointer-events: none;
          }
          .vida {
            background: #00ff57;
            filter: url(#scribble);
            border-radius: 12px 32px 12px 32px/16px 32px 16px 32px;
          }
          .pe {
            background: #ffb347;
            filter: url(#scribble);
            border-radius: 12px 32px 12px 32px/16px 32px 16px 32px;
          }
        </style>
        <svg width="0" height="0">
          <filter id="scribble">
            <feTurbulence id="turb" baseFrequency="0.03 0.08" numOctaves="2" seed="2" type="fractalNoise" result="turb"/>
            <feDisplacementMap in2="turb" in="SourceGraphic" scale="8" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </svg>
      </head>
      <body>
        <div style="display: flex; align-items: center; justify-content: center; gap: 16px; height: 260px;">
          <span class="octa-icon" style="position:relative; width:240px; height:240px; min-width:240px; min-height:240px; display: flex; align-items: center; margin-right: -12px; margin-bottom: 0;">
            ${iconUrl ? `<img src="${iconUrl}" class="octa-img" alt="icon" style="width:205px;height:205px;left:18px;bottom:18px;position:absolute;object-fit:cover;z-index:1;" />` : ''}
            <svg class="octa-svg" viewBox="0 0 240 240" style="width:240px;height:240px; position:absolute; left:0; bottom:0; z-index:2; pointer-events:none;">
              <defs>
                <filter id="scribble-icon">
                  <feTurbulence id="turbIcon" baseFrequency="0.03 0.08" numOctaves="2" seed="2" type="fractalNoise" result="turb"/>
                  <feDisplacementMap in2="turb" in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G"/>
                </filter>
              </defs>
              <polygon id="octa-shape" points="70,10 170,10 230,70 230,170 170,230 70,230 10,170 10,70" fill="none" stroke="#fff" stroke-width="12" filter="url(#scribble-icon)"/>
            </svg>
          </span>
          <div style="display: flex; flex-direction: column; gap: 24px; justify-content: center; height: 100%; transform: translateY(0px);">
            <div class="bar">
              <div id="vidaFill" class="fill vida"></div>
              <div id="vidaNum" class="number">0/0</div>
            </div>
            <div class="bar">
              <div id="peFill" class="fill pe"></div>
              <div id="peNum" class="number">0/0</div>
            </div>
          </div>
        </div>
        <script>
          // Animação do rabisco para barras e ícone
          let t = 0;
          function animateScribble() {
            t += 0.02;
            const turb = document.getElementById('turb');
            if (turb) turb.setAttribute('seed', (2 + 10 * Math.sin(t)).toString());
            const turbIcon = document.getElementById('turbIcon');
            if (turbIcon) turbIcon.setAttribute('seed', (2 + 10 * Math.cos(t)).toString());
            requestAnimationFrame(animateScribble);
          }
          animateScribble();
          async function fetchStatus() {
            const res = await fetch(window.location.pathname + '?json=1');
            if (!res.ok) return;
            const data = await res.json();
            // Vida
            const [vidaAtual, vidaMax] = data.vida.split('/').map(Number);
            const vidaPct = vidaMax > 0 ? Math.max(0, Math.min(100, 100 * vidaAtual / vidaMax)) : 0;
            const vidaFill = document.getElementById('vidaFill');
            const vidaNum = document.getElementById('vidaNum');
            vidaFill.style.width = vidaPct + '%';
            vidaNum.textContent = data.vida;
            // PE
            const [peAtual, peMax] = data.pe.split('/').map(Number);
            const pePct = peMax > 0 ? Math.max(0, Math.min(100, 100 * peAtual / peMax)) : 0;
            const peFill = document.getElementById('peFill');
            const peNum = document.getElementById('peNum');
            peFill.style.width = pePct + '%';
            peNum.textContent = data.pe;
          }
          setInterval(fetchStatus, 2000);
          fetchStatus();
        </script>
      </body>
    </html>
  `);
// Servir arquivos de ícone
app.use('/icon', express.static('./uploads'));
});

app.get('/', (req: Request, res: Response) => {
  res.send(`
    <html>
      <body>
        <h2>Gerar URL de Vida e Stamina</h2>
        <form id="sheetForm" enctype="multipart/form-data">
          <input type="text" name="sheetUrl" placeholder="Cole o link do Google Sheets" required style="width: 400px;" />
          <input type="file" name="icon" accept="image/*,image/gif" style="margin-left:12px;" required />
          <button type="submit">Gerar</button>
        </form>
        <div id="result"></div>
        <script>
          document.getElementById('sheetForm').onsubmit = async function(e) {
            e.preventDefault();
            const form = document.getElementById('sheetForm');
            const formData = new FormData(form);
            const res = await fetch('/generate', {
              method: 'POST',
              body: formData
            });
            const data = await res.json();
            document.getElementById('result').innerHTML += '<div><a href="' + data.url + '" target="_blank">' + window.location.origin + data.url + '</a></div>';
          };
        </script>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
