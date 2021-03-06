#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
const fs = require('fs-extra');
const gitBranches = require('git-branch-away');
var shell = require('shelljs');
const _ = require('lodash');
const path = require('path');
var inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));


const crypto = require('crypto');
const sha1 = (str) => crypto.createHash('sha1').update(str).digest('hex');

const init = () => {
  if (!gitBranches.isRepository()) {
    console.error('not a git repository');
    process.exit(1);
  }
  gitBranches.init();
  if (gitBranches.current()){
    updateRecentlyUsed(gitBranches.current());
  }``
}
// console.log(gitBranches.root());
const recentFilename = () => path.join(__dirname, 'recent', sha1(gitBranches.root()));
const rootsFilename = () => path.join(__dirname, 'roots.txt');

// console.log(argv, process.argv);
// process.exit(0);
//

if (argv.version){
  console.log(require('./package.json').version);
  process.exit(1);
}

function getRecentlyUsed () {
  try {
    return fs.readFileSync(recentFilename()).toString().split('\n');
  } catch (e) {
    return [];
  }
}

function updateRoot (root) {
  root = root.trim();
  let roots = getRoots();
  roots = _.uniq([root, ...roots]).map(r => r.trim()).filter(r => r.length > 0);
  fs.writeFileSync(rootsFilename(), roots.join('\n'));
}

function getRoots () {
  try {
    return _.uniq(fs.readFileSync(rootsFilename()).toString().split('\n').map(l=>l.trim()).filter(l=>l.length>0));
  } catch (e) {
    return [];
  }
}

function emptyCommit () {
  shell.exec(`git commit --allow-empty -n -m "empty commit"`);
}

function printRecentlyUsed () {
  console.log(getRecentlyUsed().join('\n'));
}

function printRoots () {
  console.log(getRoots().join('\n'));
}

function checkout (branch, newBranch=false) {
  if (branch !== '-') {
    updateRecentlyUsed(branch);
    updateRoot(gitBranches.root());
  }
  shell.exec(`git checkout ${newBranch ? '-b': ''} ${branch}`);
}

function updateRecentlyUsed (branch) {
  let recent = getRecentlyUsed();
  recent = [branch, ...recent.filter(r => r !== branch)];
  fs.ensureFileSync(recentFilename());
  fs.writeFileSync(recentFilename(), recent.join('\n'));
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

      checkout with interactive search (find)

         gitg -f

      print all repo roots you visited

         gitg @

      create empty commit

         gitg !

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
      source: (answers, input) => {
        let results = input ? branches.filter((b) => b.includes(input)) : branches;
        if (results.length === 0) {
          results = gitBranches.all().filter(b=>b.includes(input));
        }
        return Promise.resolve(results);
      }
    }
  ]).then(answers => {
    checkout(answers.branch);
  });
}

// console.log('args are', argv);
let [branch] = argv._;
if (branch === '!') {
  emptyCommit();
} else if (branch === '@') {
  printRoots();
} else {
  init();
  if (!branch && process.argv.indexOf('--') >= 0) {
    branch = '--';
  }
  // console.log('branch is', branch);

  if (argv.b) {
    const {ahead, behind} = gitBranches.getCommitsDiff();
    if (behind && behind > 0){
      if (!argv.force){
        console.error(`your branch is behind by ${behind} commits. update and try again or use --force`);
        process.exit(1);
      } else {
        console.warn(`your branch is behind by ${behind} commits. update and try again or use --force`);
      }
    }
    checkout(argv.b, true);
    process.exit(0);
  }
  if (!branch && !argv.f) {
    printRecentlyUsed();
  } else if (branch === '-') {
    checkout('-');
  } else if (branch === '--') {
    find(getRecentlyUsed());
  } else if (branch === '.') {
    console.log(gitBranches.list().current);
  } else if (branch) {
    const allBranches = gitBranches.list().all;
    const perfectMatch = allBranches.filter(b => b === branch)[0];
    if (perfectMatch){
      checkout(perfectMatch);
    } else {
      const matches = allBranches.filter(b => b.indexOf(branch) >= 0);
      // console.log('matches are', matches);
      if (matches.length === 1) {
        checkout(matches[0]);
      } else if (matches.length === 0) {
        console.log('no matches found. lets help you find it');
        find();
      } else {
        console.log('multiple options found.');
        find(matches);
      }
    }
  } else if (argv.f) {
    find();
  }
  if (argv._[0]) { gitBranches.list(); }
}
