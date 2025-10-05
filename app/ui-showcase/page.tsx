'use client';

import {
    Alert,
    Badge,
    Button,
    Card,
    Cluster,
    Code,
    Container,
    Grid,
    H1,
    H2,
    H3,
    H4,
    LoadingSpinner,
    Progress,
    Quote,
    SearchInput,
    Section,
    Skeleton,
    Stack,
    Text,
    TextArea,
    TextInput
} from '@/components/ui';
import { ArrowRight, Search } from 'lucide-react';

export default function UIShowcasePage() {
  return (
    <div className="min-h-screen bg-neutral-25">
      <Container maxWidth="2xl" padding="lg">
        <Stack gap="2xl">
          {/* Header */}
          <Section padding="lg" background="foundational">
            <Stack gap="md" align="center">
              <H1 className="text-center gradient-text">UI Component Library</H1>
              <Text variant="body-large" className="text-center text-neutral-600">
                Complete component showcase for the Mental Models Observatory
              </Text>
            </Stack>
          </Section>

          {/* Typography Section */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Typography</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H1>Heading 1 - Display Text</H1>
                    <H2>Heading 2 - Section Title</H2>
                    <H3>Heading 3 - Subsection</H3>
                    <H4>Heading 4 - Card Title</H4>
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

          {/* Button Section */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Buttons</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H3>Variants</H3>
                    <Cluster gap="md">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                    </Cluster>
                  </div>
                  
                  <div>
                    <H3>Sizes</H3>
                    <Cluster gap="md" align="center">
                      <Button size="sm">Small</Button>
                      <Button size="md">Medium</Button>
                      <Button size="lg">Large</Button>
                    </Cluster>
                  </div>
                  
                  <div>
                    <H3>With Icons</H3>
                    <Cluster gap="md">
                      <Button leftIcon={<ArrowRight />}>With Left Icon</Button>
                      <Button rightIcon={<ArrowRight />}>With Right Icon</Button>
                      <Button leftIcon={<Search />} rightIcon={<ArrowRight />}>
                        Both Icons
                      </Button>
                    </Cluster>
                  </div>
                  
                  <div>
                    <H3>States</H3>
                    <Cluster gap="md">
                      <Button loading>Loading</Button>
                      <Button disabled>Disabled</Button>
                      <Button variant="outline" loading>Loading Outline</Button>
                    </Cluster>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Input Section */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Input Components</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H3>Text Input</H3>
                    <Grid cols={2} gap="lg">
                      <TextInput 
                        label="Email Address" 
                        placeholder="Enter your email"
                        type="email"
                      />
                      <TextInput 
                        label="Username" 
                        placeholder="Enter username"
                        error="Username is required"
                      />
                    </Grid>
                  </div>
                  
                  <div>
                    <H3>Search Input</H3>
                    <SearchInput 
                      placeholder="Search mental models..."
                      onSearch={(value) => console.log('Search:', value)}
                    />
                  </div>
                  
                  <div>
                    <H3>Text Area</H3>
                    <TextArea 
                      label="Description" 
                      placeholder="Enter a description..."
                      rows={4}
                      maxLength={200}
                      showCharacterCount
                    />
                  </div>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Layout Section */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Layout Components</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H3>Grid System</H3>
                    <Grid cols={3} gap="md">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} variant="outlined" padding="md">
                          <Text className="text-center">Grid Item {i}</Text>
                        </Card>
                      ))}
                    </Grid>
                  </div>
                  
                  <div>
                    <H3>Stack & Cluster</H3>
                    <Grid cols={2} gap="lg">
                      <Stack gap="md">
                        <Text variant="body-small">Vertical Stack:</Text>
                        <Card variant="outlined" padding="sm">Item 1</Card>
                        <Card variant="outlined" padding="sm">Item 2</Card>
                        <Card variant="outlined" padding="sm">Item 3</Card>
                      </Stack>
                      
                      <div>
                        <Text variant="body-small" className="mb-md">Horizontal Cluster:</Text>
                        <Cluster gap="sm">
                          <Badge>Tag 1</Badge>
                          <Badge>Tag 2</Badge>
                          <Badge>Tag 3</Badge>
                          <Badge>Tag 4</Badge>
                        </Cluster>
                      </div>
                    </Grid>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Feedback Section */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Feedback Components</H2>
              
              <Card variant="elevated" padding="lg">
                <Stack gap="lg">
                  <div>
                    <H3>Loading Spinners</H3>
                    <Cluster gap="md" align="center">
                      <LoadingSpinner size="sm" />
                      <LoadingSpinner size="md" />
                      <LoadingSpinner size="lg" />
                      <LoadingSpinner size="xl" />
                    </Cluster>
                  </div>
                  
                  <div>
                    <H3>Alerts</H3>
                    <Stack gap="md">
                      <Alert type="info" title="Information">
                        This is an informational alert with some helpful content.
                      </Alert>
                      <Alert type="success" title="Success!" closable>
                        Your changes have been saved successfully.
                      </Alert>
                      <Alert type="warning" title="Warning">
                        Please review your input before proceeding.
                      </Alert>
                      <Alert type="error" title="Error" closable>
                        Something went wrong. Please try again.
                      </Alert>
                    </Stack>
                  </div>
                  
                  <div>
                    <H3>Badges</H3>
                    <Stack gap="md">
                      <div>
                        <Text variant="body-small" className="mb-sm">Variants:</Text>
                        <Cluster gap="sm">
                          <Badge variant="primary">Primary</Badge>
                          <Badge variant="secondary">Secondary</Badge>
                          <Badge variant="outline">Outline</Badge>
                        </Cluster>
                      </div>
                      
                      <div>
                        <Text variant="body-small" className="mb-sm">Difficulty Levels:</Text>
                        <Cluster gap="sm">
                          <Badge difficulty="beginner">Beginner</Badge>
                          <Badge difficulty="intermediate">Intermediate</Badge>
                          <Badge difficulty="advanced">Advanced</Badge>
                        </Cluster>
                      </div>
                      
                      <div>
                        <Text variant="body-small" className="mb-sm">Sizes:</Text>
                        <Cluster gap="sm" align="center">
                          <Badge size="sm">Small</Badge>
                          <Badge size="md">Medium</Badge>
                          <Badge size="lg">Large</Badge>
                        </Cluster>
                      </div>
                    </Stack>
                  </div>
                  
                  <div>
                    <H3>Progress Bars</H3>
                    <Stack gap="md">
                      <div>
                        <Text variant="body-small" className="mb-sm">Progress: 75%</Text>
                        <Progress value={75} showLabel />
                      </div>
                      <div>
                        <Text variant="body-small" className="mb-sm">Different Colors:</Text>
                        <Stack gap="sm">
                          <Progress value={60} color="foundational" />
                          <Progress value={80} color="practical" />
                          <Progress value={40} color="specialized" />
                        </Stack>
                      </div>
                    </Stack>
                  </div>
                  
                  <div>
                    <H3>Skeleton Loading</H3>
                    <Stack gap="md">
                      <Skeleton variant="text" width="100%" />
                      <Skeleton variant="text" width="75%" />
                      <Skeleton variant="text" width="50%" />
                      <Cluster gap="md">
                        <Skeleton variant="circular" width={40} height={40} />
                        <Stack gap="sm" className="flex-1">
                          <Skeleton variant="text" width="60%" />
                          <Skeleton variant="text" width="40%" />
                        </Stack>
                      </Cluster>
                    </Stack>
                  </div>
                </Stack>
              </Card>
            </Stack>
          </Section>

          {/* Card Section */}
          <Section padding="lg">
            <Stack gap="xl">
              <H2>Cards</H2>
              
              <Card variant="elevated" padding="lg">
                <Grid cols={3} gap="lg">
                  <Card variant="default" padding="md">
                    <Stack gap="sm">
                      <H4>Default Card</H4>
                      <Text variant="body-small">
                        Standard card with subtle border and background.
                      </Text>
                    </Stack>
                  </Card>
                  
                  <Card variant="elevated" padding="md" hover>
                    <Stack gap="sm">
                      <H4>Elevated Card</H4>
                      <Text variant="body-small">
                        Card with shadow and hover effects.
                      </Text>
                    </Stack>
                  </Card>
                  
                  <Card variant="outlined" padding="md" clickable>
                    <Stack gap="sm">
                      <H4>Clickable Card</H4>
                      <Text variant="body-small">
                        Interactive card with focus states.
                      </Text>
                    </Stack>
                  </Card>
                </Grid>
              </Card>
            </Stack>
          </Section>

          {/* Footer */}
          <Section padding="lg" background="neutral">
            <Stack gap="md" align="center">
              <Text variant="body-small" className="text-center text-neutral-600">
                This showcase demonstrates all UI components with their variants, 
                states, and accessibility features.
              </Text>
              <Cluster gap="sm">
                <Badge variant="outline">TypeScript</Badge>
                <Badge variant="outline">Accessible</Badge>
                <Badge variant="outline">Responsive</Badge>
                <Badge variant="outline">Performance</Badge>
              </Cluster>
            </Stack>
          </Section>
        </Stack>
      </Container>
    </div>
  );
}
