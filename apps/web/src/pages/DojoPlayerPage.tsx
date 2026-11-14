import { useParams } from 'react-router';
import { PagePlaceholder } from '@/components/PagePlaceholder';

export default function DojoPlayerPage() {
  const { id = '' } = useParams();
  return <PagePlaceholder pageKey="dojoPlayer" phase={4} titleSuffix={id} />;
}
