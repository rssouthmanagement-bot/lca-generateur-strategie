const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

function callClaude(apiKey, systemPrompt, userMessage, maxTokens = 8000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content?.[0]?.text || '');
        } catch (e) { reject(new Error('Parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(300000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function cleanHtml(text) {
  return text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}

const SYSTEM_PROMPT = `Tu es expert en strategie marketing pour South Management. Tu generes des dossiers strategiques HTML interactifs.
REGLES ABSOLUES : Retourne UNIQUEMENT du HTML brut. JAMAIS de backticks. JAMAIS de markdown. HTML pur uniquement.
Style South Management : fond sombre #0d0d0d, Bebas Neue + DM Sans, design premium.`;

function getInstructions(range, d) {
  const data = `Nom: ${d.nom_marque}|Secteur: ${d.secteur}|Ville: ${d.ville}|Zone: ${d.zone_km}km|Formule: ${d.formule}|Date debut: ${d.date_debut}|CA: ${d.ca_mensuel}EUR|Panier: ${d.panier_moyen}EUR|Budget ads: ${d.budget_ads}EUR|Offres: ${d.offres}|Hero: ${d.offre_hero}|Differenciateur: ${d.differenciateur}|Client ideal: ${d.client_ideal}|Probleme: ${d.probleme_resolu}|Concurrents: ${d.concurrents}|Forces concurrents: ${d.forces_concurrents}|Membres camera: ${d.membres_camera}|Materiel: ${d.materiel}|Dates eviter: ${d.dates_eviter}|Dates cles: ${d.dates_cles}|Couleurs: ${d.couleurs}|Ambiance: ${d.ambiance_visuelle}|Lieu tournage: ${d.lieu_tournage}`;
  const base = `DONNEES CLIENT: ${data}\n\n`;
  const css = range === '1-2' ? `Commence par <!DOCTYPE html><html lang="fr"><head> avec CSS complet (Google Fonts Bebas Neue+DM Sans, variables couleurs marque, styles navigation, styles slides). Structure: <body><nav class="nav"><!-- 15 boutons numerotes --></nav><div class="slides-container"><div class="slide active" id="s1">...</div><div class="slide" id="s2">...</div></div>. PAS de </body> ni </html> ni JavaScript.` : `HTML pur uniquement - juste les divs slide demandees. PAS de DOCTYPE ni head ni CSS.`;
  const map = {
    '1-2': `SLIDE 1 COUVERTURE: nom marque enorme Bebas Neue, concept central 2-5 mots, tagline "Le seul [produit] [caracteristique] de [ville]", opportunite CA +12 mois chiffree, dates contrat, CONFIDENTIEL, note equipe. SLIDE 2 A QUOI SERT CE DOC: bloc equipe 5 utilisations avec numeros slides, bloc restaurateur 5 utilisations, ce que ce doc n'est PAS, tableau temps/actions.`,
    '3-4': `SLIDE 3 RESUME EXECUTIF: constat CA+transactions+diagnostic, objectif 12 mois CA x1.6, 3 leviers chiffres, ROI 12 mois. SLIDE 4 SWOT: forces preuves filmables, faiblesses manque gagner euros, opportunites potentiel euros, menaces probabilite+parade, analyse croisee.`,
    '5-6': `SLIDE 5 BENCHMARK: tableau concurrents+marque cliente, colonnes Forces/Faiblesses/Prix/Notre avantage, Blue Ocean positioning. SLIDE 6 TAGLINE BRANDING: 3 niveaux taglines avec regles usage, palette 4 couleurs client hexa+usage+emotion.`,
    '7-8': `SLIDE 7 DIRECTION ARTISTIQUE: concept visuel 3-5 mots, ce qu'on NE fait PAS, 3 regles shooting NON-NEGOCIABLES format [Contrainte].[Pourquoi].[Consequence], materiel client usage+reglage, typographies. SLIDE 8 TONE OF VOICE: voix 3 adjectifs, registre par canal TikTok/Instagram/Facebook/Stories, 3 captions utilisables aujourd'hui, 3 anti-exemples expliques.`,
    '9-10': `SLIDE 9 PERSONA JOURNEY: persona prenom+age+comportement digital, insight Avant/Apres, frein+levier, 2 messages cles, customer journey 4 phases. SLIDE 10 PILIERS EDITORIAUX: 4 piliers 40/25/20/15%, top 4 formats video hook exact+duree+funnel+notes tournage, planning hebdo.`,
    '11-12': `SLIDE 11 META ADS BOOST: budget reparti TOFU/MOFU/BOFU, principe boost "on ne booste que ce qui prouve", 3 etapes boost, regle "probleme toujours dans la video jamais le budget", tableau 4 regles optimisation. SLIDE 12 ROADMAP 12 MOIS: demarre ${d.date_debut}, 4 trimestres nommes, chaque mois CA cible+5 actions+budget ads+3 KPIs, signaler dates eviter et cles.`,
    '13-14': `SLIDE 13 PLAN OPERATIONNEL: 4 premieres semaines, tableau jour par jour MATIN/MIDI/SOIR, codes PROD/EQUIPE/PUBLI/ADS/REPOS, instructions exactes "Pose telephone [position]. Filme [sujet] [duree]. Envoie a [contact]." et "Hook: [exact]. Caption: [exact]. Publier a [heure]." SLIDE 14 PROJECTION ANNUELLE: calendrier 12 mois CA cible+evenement+axe+offre, 3 pics opportunite, 2 creux+compensation, 4 periodes decisives.`,
    '15-nav': `SLIDE 15 KPIS: dashboard 6 metriques Baseline/M3/M6/M12, 3 zones feu tricolore VERT/ORANGE/ROUGE, equation succes personnalisee, 3 regles or specifiques client, action immediate semaine 1 + tagline a copier. Apres slide 15 ajoute: <script>const slides=document.querySelectorAll('.slide');const navBtns=document.querySelectorAll('.nav-btn');let cur=0;function goTo(n){slides[cur].classList.remove('active');navBtns[cur].classList.remove('active');cur=Math.max(0,Math.min(n,slides.length-1));slides[cur].classList.add('active');navBtns[cur].classList.add('active');window.scrollTo(0,0);}document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown')goTo(cur+1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')goTo(cur-1);});<\/script></body></html>`
  };
  return base + css + '\n\n' + (map[range] || '');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    return;
  }
  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { apiKey, clientData } = JSON.parse(body);
        if (!apiKey) { res.writeHead(400); res.end(JSON.stringify({error:'Cle API manquante'})); return; }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const ranges = ['1-2','3-4','5-6','7-8','9-10','11-12','13-14','15-nav'];
        const parts = [];
        for (let i = 0; i < ranges.length; i++) {
          res.write(`data: ${JSON.stringify({step:i+1,total:8,label:'Generation slides '+ranges[i]+'...'})}

`);
          const html = await callClaude(apiKey, SYSTEM_PROMPT, getInstructions(ranges[i], clientData), 8000);
          parts.push(cleanHtml(html));
        }
        const final = parts.join('\n');
        const encoded = Buffer.from(final).toString('base64');
        res.write(`data: ${JSON.stringify({done:true,html:encoded,filename:'strategie_'+clientData.nom_marque.replace(/\s+/g,'_')+'.html'})}

`);
        res.end();
      } catch(err) { res.write(`data: ${JSON.stringify({error:err.message})}

`); res.end(); }
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('LCA App demarree sur port', PORT));
