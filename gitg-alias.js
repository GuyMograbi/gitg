#!/usr/bin/env node
const findup = require('find-up');
const argv = require('minimist')(process.argv.slice(2));
const _ = require('lodash');
const path = require('path');
const open = require('open');
const YAML = require('yamljs');
const gitgConf = findup.sync('.gitg') || path.join(require('os').homedir(), '.gitg');
const fs = require('fs-extra');
const meow = require('meow');

meow(`
  gitg-alias name

    Will output the alias value for name

  gitg-alias name value

    Will insert new entry or override existing one

  gitg-alias <empty>

    Will list all existing aliases

 gitg-alias --help

 gitg-alias --open

    Opens the .gitg config file to edit aliases

 gitg-alias --version
`)

fs.ensureFileSync(gitgConf);

if (argv.open) {
  open(gitgConf);
}

if (argv.help) {
  consoe
}

const padStr = '                       ';
const pad = (str, size = 20) => {
  str = str.slice(0, 20);
  return str + padStr.slice(0, Math.min(size,20) - str.length);
}

const toKey = (k) => `aliases.${k}`;

const conf = YAML.load(gitgConf) || {};

const [key, value] = argv._;
if (value) { // add/set value
  _.set(conf, toKey(key), value);
  fs.writeFileSync(gitgConf, YAML.stringify(conf));
  process.exit(0);
} else if (!key) { // list all entries
  console.log(Object.keys(conf.aliases || {}).map(k => {
    return `${pad(k)}\t${conf.aliases[k]}`;
  }).join('\n'));
} else { // has key. lets find value
  console.log(_.get(conf, toKey(key)));
  process.exit(0);
}
