import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionPlaceholderPageProps = {
  sectionName: string;
};

const SectionPlaceholderPage = ({ sectionName }: SectionPlaceholderPageProps) => {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background px-4 py-6 sm:px-6">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>{sectionName}</CardTitle>
          <CardDescription>This section is initialized and ready for us to build next.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
            No content has been added here yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SectionPlaceholderPage;
