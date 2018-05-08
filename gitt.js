#!/usr/bin/env node
const gitBranches = require('git-branch-away');
const path = require('path');
var argv = require('minimist')(process.argv.slice(2));
const recentFilename = path.join(__dirname, 'recent','history.txt');
const fs = require('fs');
function printRecentlyUsed(){
  console.log(fs.readFileSync(recentFilename).toString());
}

// console.log('args are', argv);
[branch] = argv._;
// console.log('branch is', branch);
//
if (!branch){
  printRecentlyUsed();
} else if (branch === '-') {
  console.log(gitBranches.all().join('\n'));
}
if (argv._[0])
gitBranches.list();
