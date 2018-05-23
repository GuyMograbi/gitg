#!/usr/bin/env node
const gitBranches = require('git-branch-away');
var shell = require('shelljs');
const path = require('path');
var inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
var argv = require('minimist')(process.argv.slice(2));

const crypto = require('crypto');
const sha1 = (str) => crypto.createHash('sha1').update(str).digest('hex');

gitBranches.init();
// console.log(gitBranches.root());
const recentFilename = path.join(__dirname, 'recent', sha1(gitBranches.root()));
const rootsFilename = path.join(__dirname, 'roots.txt');

const fs = require('fs');

// console.log(argv, process.argv);
// process.exit(0);

function getRecentlyUsed () {
  try {
    return fs.readFileSync(recentFilename).toString().split('\n');
  } catch (e) {
    return [];
  }
}

function updateRoot (root) {
  let roots = getRoots();
  roots = [root, ...roots.filter(r => r !== root)];
  fs.writeFileSync(rootsFilename, roots.join('\n'));
}

function getRoots () {
  try {
    return fs.readFileSync(rootsFilename).toString().split('\n');
  } catch (e) {
    return [];
  }
}

function printRecentlyUsed () {
  console.log(getRecentlyUsed().join('\n'));
}

function printRoots () {
  console.log(getRoots().join('\n'));
}

function checkout (branch) {
  if (branch !== '-') {
    updateRecentlyUsed(branch);
    updateRoot(gitBranches.root());
  }
  shell.exec(`git checkout ${branch}`);
}

function updateRecentlyUsed (branch) {
  let recent = getRecentlyUsed();
  recent = [branch, ...recent.filter(r => r !== branch)];
  fs.writeFileSync(recentFilename, recent.join('\n'));
}

if (argv.help) {
  console.log(
    `
      print current branch

          gitg .

      show recent branches used. (simply gitg without any parameter)

         gitg

      checkout last branch (just like git checkout -)

         gitg -

       checkout searching recently used branches

         gitg --

       checkout while fuzzy searching (will fall back to interactive search if multiple options)

          gitg some_name

      checkout with interatice search (find)

         gitg -f
    `
  );
  process.exit(0);
}

function find (branches = gitBranches.list().all) {
  inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'branch',
      message: 'start typing to search your branch',
      // source: (answers, input) => ['mouse', 'house']
      source: (answers, input) => Promise.resolve(input ? branches.filter((b) => b.includes(input)) : branches)
    }
  ]).then(answers => {
    checkout(answers.branch);
  });
}

// console.log('args are', argv);
let [branch] = argv._;
if (!branch && process.argv.indexOf('--') >= 0) {
  branch = '--';
}
// console.log('branch is', branch);
//
if (!branch && !argv.f) {
  printRecentlyUsed();
} else if (branch === '-') {
  checkout('-');
} else if (branch === '--') {
  find(getRecentlyUsed());
} else if (branch === '@') {
  printRoots();
} else if (branch === '.') {
  console.log(gitBranches.list().current);
} else if (branch) {
  const matches = gitBranches.list().all.filter(b => b.indexOf(branch) >= 0);
  console.log('matches are', matches);
  if (matches.length === 1) {
    checkout(matches[0]);
  } else if (matches.length === 0) {
    console.log('no matches found. lets help you find it');
    find();
  } else {
    console.log('multiple options found.');
    find(matches);
  }
} else if (argv.f) {
  find();
}
if (argv._[0]) { gitBranches.list(); }
