import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Alert, LoadingSpinner, Progress, Skeleton } from '@/components/ui/Feedback';
import { Cluster, Container, Grid, Section, Stack } from '@/components/ui/Layout';
import { Code, H1, H2, H3, H4, Quote, Text } from '@/components/ui/Typography';

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-neutral-25">
      <Container maxWidth="2xl" padding="lg">
        <Stack gap="2xl">
          {/* Header */}
          <Section padding="lg" background="foundational">
            <Stack gap="md" align="center">
              <H1 className="text-center gradient-text">Design System</H1>
              <Text variant="body-large" className="text-center text-neutral-600">
                Complete design system showcase for the Mental Models Observatory
              </Text>
            </Stack>
          </Section>

          {/* Color System */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Color System</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H3>Primary Colors</H3>
                    <Grid cols={4} gap="md">
                      <div className="space-y-sm">
                        <div className="h-16 bg-foundational-600 rounded-medium"></div>
                        <Text variant="body-small" className="text-center">Foundational</Text>
                        <Text variant="caption" className="text-center text-neutral-500">#1e40af</Text>
                      </div>
                      <div className="space-y-sm">
                        <div className="h-16 bg-practical-600 rounded-medium"></div>
                        <Text variant="body-small" className="text-center">Practical</Text>
                        <Text variant="caption" className="text-center text-neutral-500">#dc2626</Text>
                      </div>
                      <div className="space-y-sm">
                        <div className="h-16 bg-specialized-600 rounded-medium"></div>
                        <Text variant="body-small" className="text-center">Specialized</Text>
                        <Text variant="caption" className="text-center text-neutral-500">#059669</Text>
                      </div>
                      <div className="space-y-sm">
                        <div className="h-16 bg-accent-500 rounded-medium"></div>
                        <Text variant="body-small" className="text-center">Accent</Text>
                        <Text variant="caption" className="text-center text-neutral-500">#f59e0b</Text>
                      </div>
                    </Grid>
                  </div>
                  
                  <div>
                    <H3>Neutral Scale</H3>
                    <Grid cols={6} gap="sm">
                      {[0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                        <div key={shade} className="space-y-xs">
                          <div 
                            className={`h-12 rounded-small border border-neutral-200 ${shade === 0 ? 'bg-neutral-0' : `bg-neutral-${shade}`}`}
                          ></div>
                          <Text variant="caption" className="text-center text-neutral-600">
                            {shade}
                          </Text>
                        </div>
                      ))}
                    </Grid>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Typography */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Typography</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H1>Display Heading</H1>
                    <H2>Section Heading</H2>
                    <H3>Subsection Heading</H3>
                    <H4>Card Heading</H4>
                  </div>
                  
                  <div>
                    <Text variant="body-large">Body Large - Important content and descriptions</Text>
                    <Text variant="body">Body - Standard paragraph text for most content</Text>
                    <Text variant="body-small">Body Small - Secondary information and captions</Text>
                    <Text variant="caption">Caption - Metadata and fine print</Text>
                  </div>
                  
                  <div>
                    <Code>Inline code example</Code>
                    <Code variant="block">
                      {`// Code block example
function example() {
  return "Hello World";
}`}
                    </Code>
                  </div>
                  
                  <Quote author="Albert Einstein" source="The World As I See It">
                    Imagination is more important than knowledge. For knowledge is limited, 
                    whereas imagination embraces the entire world, stimulating progress, 
                    giving birth to evolution.
                  </Quote>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Components */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Components</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H3>Buttons</H3>
                    <Cluster gap="md">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                    </Cluster>
                  </div>
                  
                  <div>
                    <H3>Badges</H3>
                    <Cluster gap="sm">
                      <Badge variant="primary">Primary</Badge>
                      <Badge variant="secondary">Secondary</Badge>
                      <Badge variant="outline">Outline</Badge>
                      <Badge difficulty="beginner">Beginner</Badge>
                      <Badge difficulty="intermediate">Intermediate</Badge>
                      <Badge difficulty="advanced">Advanced</Badge>
                    </Cluster>
                  </div>
                  
                  <div>
                    <H3>Alerts</H3>
                    <Stack gap="md">
                      <Alert type="info" title="Information">
                        This is an informational alert with helpful content.
                      </Alert>
                      <Alert type="success" title="Success!">
                        Your changes have been saved successfully.
                      </Alert>
                      <Alert type="warning" title="Warning">
                        Please review your input before proceeding.
                      </Alert>
                      <Alert type="error" title="Error">
                        Something went wrong. Please try again.
                      </Alert>
                    </Stack>
                  </div>
                  
                  <div>
                    <H3>Loading States</H3>
                    <Cluster gap="md" align="center">
                      <LoadingSpinner size="sm" />
                      <LoadingSpinner size="md" />
                      <LoadingSpinner size="lg" />
                      <LoadingSpinner size="xl" />
                    </Cluster>
                  </div>
                  
                  <div>
                    <H3>Progress</H3>
                    <Stack gap="md">
                      <Progress value={75} showLabel />
                      <Progress value={60} color="foundational" />
                      <Progress value={80} color="practical" />
                    </Stack>
                  </div>
                  
                  <div>
                    <H3>Skeleton Loading</H3>
                    <Stack gap="md">
                      <Skeleton variant="text" width="100%" />
                      <Skeleton variant="text" width="75%" />
                      <Skeleton variant="text" width="50%" />
                    </Stack>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Visual Effects */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Visual Effects</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H3>Gradient Text</H3>
                    <H2 className="gradient-text">Gradient Heading</H2>
                    <Text variant="body-large" className="gradient-text-accent">
                      Gradient text with accent colors
                    </Text>
                  </div>
                  
                  <div>
                    <H3>Glassmorphism</H3>
                    <div className="glass p-lg rounded-large">
                      <Text>Glass effect with backdrop blur and transparency</Text>
                    </div>
                  </div>
                  
                  <div>
                    <H3>Shadows</H3>
                    <Grid cols={3} gap="md">
                      <div className="p-md bg-neutral-0 rounded-medium shadow-subtle">
                        <Text variant="body-small">Subtle</Text>
                      </div>
                      <div className="p-md bg-neutral-0 rounded-medium shadow-medium">
                        <Text variant="body-small">Medium</Text>
                      </div>
                      <div className="p-md bg-neutral-0 rounded-medium shadow-strong">
                        <Text variant="body-small">Strong</Text>
                      </div>
                    </Grid>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Footer */}
          <Section padding="lg" background="neutral">
            <Stack gap="md" align="center">
              <Text variant="body-small" className="text-center text-neutral-600">
                This design system provides consistent, accessible, and beautiful components 
                for the Mental Models Observatory.
              </Text>
              <Cluster gap="sm">
                <Badge variant="outline">WCAG 2.1 AA</Badge>
                <Badge variant="outline">Responsive</Badge>
                <Badge variant="outline">TypeScript</Badge>
                <Badge variant="outline">Performance</Badge>
              </Cluster>
            </Stack>
          </Section>
        </Stack>
      </Container>
    </div>
  );
}
