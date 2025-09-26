// The 21 domain names you listed - let's find their actual model slugs and test them
const domain21Names = [
  "Energy as Core Resource & Ultimate Constraint",
  "Mental Models & Cross-Disciplinary Thinking", 
  "Psychology & Human Behavior",
  "Philosophy & Truth-Seeking",
  "Exponential Thinking & Compounding",
  "Spatial-Geometric Thinking & Constraints",
  "Temporal Dynamics & Flow States",
  "Power Dynamics & Political Systems",
  "Language & Communication Systems",
  "Technology & Human-Computer Interaction",
  "Organizational Design & Institutions",
  "Relationships & Human Connection", 
  "Health & Human Optimization",
  "Mindfulness & Inner Work",
  "Evolution & Biology",
  "Mathematics & Logic",
  "History & Institutional Evolution",
  "Neuroscience & Consciousness",
  "Narrative & Identity",
  "Constraint Theory & Optimization",
  "Emergence & Levels of Abstraction"
];

// Some likely model slugs to test based on the domain names
const modelSlugsToTest = [
  "energy-core-resource-ultimate-constraint",
  "models-as-mental-procedures-operating-systems",
  "cross-disciplinary-synthesis-best-answer-problem",
  "system-1-vs-system-2-thinking",
  "cognitive-biases-systematic-errors",
  "first-principles-thinking",
  "critical-approach-fallibilism",
  "exponential-thinking-compounding",
  "daily-compounding",
  "fractals-self-similarity",
  "flow-states-optimal-experience",
  "power-concentration-centralization",
  "language-mental-model-reverse-compression",
  "human-computer-symbiosis",
  "coordination-mechanisms",
  "love-nuclear-fuel",
  "physical-foundations-infrastructure",
  "present-moment-awareness",
  "variation-selection-heredity",
  "statistical-inference-sample-size-awareness",
  "hard-problem-consciousness-integration",
  "identity-narrative-construction",
  "bottlenecks-system-constraints",
  "levels-emergence-scale-transitions"
];

async function test21Models() {
  console.log('=== TESTING 21 SPECIFIC MODELS FOR READWISE HIGHLIGHTS ===\n');

  const results = [];
  
  for (const slug of modelSlugsToTest) {
    try {
      const response = require('child_process').execSync(
        `curl -s http://localhost:3000/api/readwise/highlights/${slug}`, 
        { encoding: 'utf8' }
      );
      const data = JSON.parse(response);
      const highlightCount = data.curatedHighlights ? data.curatedHighlights.length : 0;
      
      results.push({
        slug,
        highlights: highlightCount,
        working: highlightCount > 0
      });
      
      console.log(`${highlightCount > 0 ? '✅' : '❌'} ${slug}: ${highlightCount} highlights`);
      
    } catch (error) {
      console.log(`❌ ${slug}: ERROR - ${error.message.substring(0, 50)}...`);
      results.push({
        slug,
        highlights: 0,
        working: false,
        error: true
      });
    }
  }

  console.log('\n📊 SUMMARY:');
  const working = results.filter(r => r.working);
  const notWorking = results.filter(r => !r.working);
  
  console.log(`Working: ${working.length}`);
  console.log(`Not working: ${notWorking.length}`);
  console.log(`Success rate: ${Math.round(working.length/results.length*100)}%`);

  console.log('\n❌ NOT WORKING:');
  notWorking.forEach(model => {
    console.log(`  ${model.slug}`);
  });

  console.log('\n✅ WORKING:');
  working.forEach(model => {
    console.log(`  ${model.slug} (${model.highlights} highlights)`);
  });
}

test21Models();
