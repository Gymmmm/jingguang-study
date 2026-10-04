import { Communicate } from 'edge-tts.js';

const VOICES = {
  yunjian: 'zh-CN-YunjianNeural',
  yunyang: 'zh-CN-YunyangNeural',
  yunxi: 'zh-CN-YunxiNeural',
  yunxia: 'zh-CN-YunxiaNeural',
  yunjhe: 'zh-TW-YunJheNeural',
  wanlung: 'zh-HK-WanLungNeural'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { text = '', voice = 'yunjian', rate = 1 } = req.body || {};
  const input = String(text).replace(/\s+/g, ' ').trim().slice(0, 1800);
  if (!input) return res.status(400).json({ error: 'text_required' });
  const voiceId = VOICES[voice] || VOICES.yunjian;
  const speed = Math.max(.75, Math.min(1.5, Number(rate) || 1));
  const ratePct = Math.round((speed - 1) * 100);
  try {
    const tts = new Communicate(input, voiceId, { rate: `${ratePct >= 0 ? '+' : ''}${ratePct}%` });
    const chunks = [];
    for await (const chunk of tts.stream()) {
      if (chunk.type === 'audio' && chunk.data) chunks.push(Buffer.from(chunk.data));
    }
    if (!chunks.length) throw new Error('empty_audio');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).send(Buffer.concat(chunks));
  } catch (error) {
    return res.status(502).json({ error: 'tts_unavailable' });
  }
}
