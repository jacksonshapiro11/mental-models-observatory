// Original with blank lines
const original = `Video call with your friend in Tokyo. You're laughing at something they said five seconds ago.

They're already responding to something else.

Relativity & Space-Time.

There's no universal "now." Each observer experiences their own present moment depending on location and speed.

From Reality Is Not What It Seems by Carlo Rovelli:

"There is past and future, but the present exists only locally. What is 'now' on Earth happened 15 minutes ago on Mars."

The delay isn't a technical glitch. It's physics.

I read a lot. Wanted to remember what mattered. Built this to help me think clearer. Maybe it helps you.

https://www.cosmictrex.xyz/models/relativity-space-time`;

// Condensed (replace double newlines with single)
const condensed = original.replace(/\n\n/g, '\n');

console.log('Original length:', original.length);
console.log('Condensed length:', condensed.length);
console.log('Condensed fits?', condensed.length <= 280 ? '✅ YES' : '❌ NO - needs ' + (condensed.length - 280) + ' fewer chars');

