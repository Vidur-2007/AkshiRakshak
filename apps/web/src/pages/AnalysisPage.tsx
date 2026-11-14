import { useParams } from 'react-router';
import { PagePlaceholder } from '@/components/PagePlaceholder';

export default function AnalysisPage() {
  const { id = '' } = useParams();
  return <PagePlaceholder pageKey="analysis" phase={1} titleSuffix={`#${id.slice(0, 8)}`} />;
}
