const fs = require('fs');
const path = require('path');
const http = require('http');

// Read the main data file
const readwiseDataPath = path.join(__dirname, '../lib/readwise-data.ts');
const content = fs.readFileSync(readwiseDataPath, 'utf8');

// Extract READWISE_MODELS array
const modelsMatch = content.match(/export const READWISE_MODELS[^=]*=\s*(\[[\s\S]*?\n\]);/);
if (!modelsMatch) {
  console.error('Could not find READWISE_MODELS in readwise-data.ts');
  process.exit(1);
}

const modelsArray = eval(modelsMatch[1]);

console.log(`\n🧪 Testing ${modelsArray.length} model pages on localhost:3000...\n`);

let successCount = 0;
let failCount = 0;
const failures = [];

async function testModel(model, index) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/models/${model.slug}`,
      method: 'GET',
      timeout: 15000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        successCount++;
        if ((index + 1) % 10 === 0) {
          console.log(`✅ Tested ${index + 1}/${modelsArray.length} models...`);
        }
      } else {
        failCount++;
        failures.push({
          num: index + 1,
          name: model.name,
          slug: model.slug,
          status: res.statusCode
        });
      }
      resolve();
    });

    req.on('error', (e) => {
      failCount++;
      failures.push({
        num: index + 1,
        name: model.name,
        slug: model.slug,
        error: e.message
      });
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      failCount++;
      failures.push({
        num: index + 1,
        name: model.name,
        slug: model.slug,
        error: 'Timeout'
      });
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  for (let i = 0; i < modelsArray.length; i++) {
    await testModel(modelsArray[i], i);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RESULTS:`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Success: ${successCount}/${modelsArray.length}`);
  console.log(`❌ Failed: ${failCount}/${modelsArray.length}`);

  if (failures.length > 0) {
    console.log(`\n❌ FAILED MODELS:\n`);
    failures.forEach(f => {
      console.log(`   ${f.num}. ${f.name}`);
      console.log(`      Slug: ${f.slug}`);
      console.log(`      Issue: ${f.status || f.error}`);
      console.log();
    });
  } else {
    console.log(`\n🎉 All models are working perfectly!\n`);
  }
}

runTests();

