import type { Metadata } from 'next';
import { MoveReceiver } from '../../components/domain/MoveReceiver';
import { GAME_NAME } from '../../config/appMeta';

export const metadata: Metadata = {
  title: `새 주소로 옮기는 중 · ${GAME_NAME}`,
  robots: { index: false, follow: false },
};

export default function MovePage() {
  return <MoveReceiver />;
}
