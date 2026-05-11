import { registerPlugin, Capacitor } from '@capacitor/core';

interface GpxSaverPlugin {
  stage(opts: { content: string }): Promise<{ stagePath: string }>;
  save(opts: { filename: string; stagePath: string }): Promise<{ uri: string }>;
}

const GpxSaver = registerPlugin<GpxSaverPlugin>('GpxSaver');

export class SaveCancelledError extends Error {
  readonly name = 'SaveCancelledError';
}

/**
 * Stage the GPX content native-side (one large native call), then open the
 * system "Save As" picker (one small native call). Splitting these two steps
 * keeps the PluginCall bundle small enough to survive the Activity round-trip
 * even on Android's strict TransactionTooLarge threshold.
 */
export async function saveGpxFile(filename: string, content: string): Promise<string> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Saving files is only available in the Android app.');
  }
  const { stagePath } = await GpxSaver.stage({ content });
  try {
    const { uri } = await GpxSaver.save({ filename, stagePath });
    return uri;
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? '';
    if (msg.includes('cancel')) throw new SaveCancelledError();
    throw e;
  }
}
