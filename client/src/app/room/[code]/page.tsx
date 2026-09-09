'use client';

import { useParams } from 'next/navigation';
import RoomPage from '@/components/RoomPage';

export default function Room() {
  const params = useParams();
  const code = (params?.code as string)?.toUpperCase() ?? '';
  return <RoomPage code={code} />;
}
