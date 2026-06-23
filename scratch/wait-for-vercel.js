const { execSync } = require('child_process');

function main() {
  console.log('Waiting for Vercel build to complete...');
  for (let i = 0; i < 20; i++) {
    try {
      const output = execSync('vercel list', { encoding: 'utf8' });
      if (output.includes('● Building')) {
        console.log(`[${i}] Still building, waiting 5s...`);
        execSync('sleep 5');
      } else {
        console.log('Build completed!');
        console.log(output.split('\n').slice(0, 10).join('\n'));
        return;
      }
    } catch (err) {
      console.error('Error running vercel list:', err.message);
      execSync('sleep 5');
    }
  }
  console.log('Timeout waiting for build');
}

main();
