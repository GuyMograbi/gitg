const shell = require('shelljs');
const chalk = require('chalk');

function getUserEmail() {
  const result = shell.exec('git config user.email', { silent: true });
  if (result.code !== 0) {
    console.error('Failed to get user email from git config');
    process.exit(1);
  }
  return result.stdout.trim();
}

function getStatsForDate(email, date, timezone) {
  // Get commits with ISO 8601 timestamps (includes timezone info)
  const gitLogCmd = `git log --all --author="${email}" --since="${date} 00:00:00" --until="${date} 23:59:59" --pretty=format:"%ai|%H" --numstat`;
  const logResult = shell.exec(gitLogCmd, { silent: true });
  if (logResult.code !== 0) return { added: 0, removed: 0, net: 0, commits: 0 };

  const lines = logResult.stdout.split('\n');
  let commits = 0;
  let added = 0;
  let removed = 0;
  let inTargetDate = false;

  for (const line of lines) {
    if (line.includes('|')) {
      // Commit header: "2025-12-30 00:08:37 +0000|hash"
      const timestampStr = line.split('|')[0];
      const commitDate = new Date(timestampStr);

      // Convert to target timezone and extract date
      let dateInTargetTz;
      if (timezone) {
        dateInTargetTz = commitDate.toLocaleString('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).split(',')[0];
      } else {
        dateInTargetTz = commitDate.toISOString().split('T')[0];
      }

      inTargetDate = (dateInTargetTz === date);
      if (inTargetDate) {
        commits++;
      }
    } else if (inTargetDate && line.trim()) {
      // Numstat line for a commit in target date
      const parts = line.trim().split(/\s+/);
      const addedLines = parseInt(parts[0], 10) || 0;
      const removedLines = parseInt(parts[1], 10) || 0;
      added += addedLines;
      removed += removedLines;
    }
  }

  return { added, removed, net: added - removed, commits };
}

function getStatsForHour(email, hourStr, timezone, targetDate) {
  // Get commits with ISO 8601 timestamps
  const gitLogCmd = `git log --all --author="${email}" --since="today ${hourStr}:00:00" --until="today ${hourStr}:59:59" --pretty=format:"%ai|%H" --numstat`;
  const logResult = shell.exec(gitLogCmd, { silent: true });
  if (logResult.code !== 0) return { added: 0, removed: 0 };

  const lines = logResult.stdout.split('\n');
  let added = 0;
  let removed = 0;
  let inTargetHour = false;

  for (const line of lines) {
    if (line.includes('|')) {
      // Commit header with timestamp
      const timestampStr = line.split('|')[0];
      const commitDate = new Date(timestampStr);

      // Convert to target timezone and extract date and hour
      let dateTimeInTargetTz;
      if (timezone) {
        const dateStr = commitDate.toLocaleString('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).split(',')[0];
        const hour = commitDate.toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }).padStart(2, '0');
        dateTimeInTargetTz = `${dateStr}-${hour}`;
      } else {
        const isoStr = commitDate.toISOString();
        const dateStr = isoStr.split('T')[0];
        const hour = isoStr.split('T')[1].substring(0, 2);
        dateTimeInTargetTz = `${dateStr}-${hour}`;
      }

      inTargetHour = (dateTimeInTargetTz === `${targetDate}-${hourStr}`);
    } else if (inTargetHour && line.trim()) {
      // Numstat line
      const parts = line.trim().split(/\s+/);
      const addedLines = parseInt(parts[0], 10) || 0;
      const removedLines = parseInt(parts[1], 10) || 0;
      added += addedLines;
      removed += removedLines;
    }
  }

  return { added, removed };
}

function calculateDailyTrend(currentAdded, previousAdded) {
  if (previousAdded === 0) {
    if (currentAdded > 0) return { trend: '+∞%', color: chalk.green };
    return { trend: '0%', color: chalk.gray };
  }

  const change = currentAdded - previousAdded;
  const percentage = Math.round((change / previousAdded) * 100);

  const sign = percentage > 0 ? '+' : '';
  const trendStr = `${sign}${percentage}%`;

  if (percentage > 10) return { trend: trendStr, color: chalk.green };
  if (percentage < -10) return { trend: trendStr, color: chalk.red };
  return { trend: trendStr, color: chalk.yellow };
}

function getContributionStats(customEmail, timezone) {
  const email = customEmail || getUserEmail();
  const tzInfo = timezone ? ` (${timezone})` : '';
  console.log(chalk.bold.cyan(`\n📊 Contribution Statistics for: ${email}${tzInfo}\n`));

  // Collect daily data
  const dailyData = [];
  const execOptions = timezone ? { silent: true, env: { ...process.env, TZ: timezone } } : { silent: true };
  for (let i = 30; i >= 0; i--) {
    const dateCmd = process.platform === 'darwin'
      ? `date -v-${i}d +%Y-%m-%d`
      : `date -d "${i} days ago" +%Y-%m-%d`;

    const dateResult = shell.exec(dateCmd, execOptions);
    if (dateResult.code !== 0) continue;

    const date = dateResult.stdout.trim();
    const stats = getStatsForDate(email, date, timezone);

    dailyData.push({ date, ...stats });
  }

  // Daily breakdown
  console.log(chalk.bold('=== Daily Breakdown (Last 30 Days) ===\n'));

  if (dailyData.length === 0) {
    console.log(chalk.gray('No data available.\n'));
  } else {
    const maxAdded = Math.max(...dailyData.map(d => d.added));
    const maxRemoved = Math.max(...dailyData.map(d => d.removed));
    const maxNet = Math.max(...dailyData.map(d => Math.abs(d.net)));
    const maxCommits = Math.max(...dailyData.map(d => d.commits));
    const addedWidth = Math.max(String(maxAdded).length, 5);
    const removedWidth = Math.max(String(maxRemoved).length, 5);
    const netWidth = Math.max(String(maxNet).length + 1, 5); // +1 for sign
    const commitsWidth = Math.max(String(maxCommits).length, 7);

    // Calculate max trend width
    const trends = dailyData.map((day, index) => {
      let previousNet = 0;
      if (index < dailyData.length - 1) {
        previousNet = dailyData[index + 1].net;
      }
      return calculateDailyTrend(day.net, previousNet);
    });
    const trendWidth = Math.max(...trends.map(t => t.trend.length), 5);

    // Print header
    console.log(
      chalk.gray('Date       ') + ' ' +
      chalk.gray('Trend'.padStart(trendWidth)) + '  ' +
      chalk.magenta('Commits'.padStart(commitsWidth)) + '  ' +
      chalk.green('Added'.padStart(addedWidth)) + '  ' +
      chalk.red('Removed'.padStart(removedWidth)) + '  ' +
      chalk.cyan('Net'.padStart(netWidth))
    );
    console.log(chalk.gray('─'.repeat(11 + trendWidth + commitsWidth + addedWidth + removedWidth + netWidth + 10)));

    dailyData.forEach((day, index) => {
      const { date, added, removed, net, commits } = day;

      // For days with no activity, show empty trend
      let trendStr, color;
      if (added === 0 && removed === 0) {
        trendStr = '-'.padStart(trendWidth);
        color = chalk.gray;
      } else {
        // Compare to same day last week (7 days ago)
        let previousAdded = 0;
        const weekAgoIndex = index - 7;
        if (weekAgoIndex >= 0) {
          previousAdded = dailyData[weekAgoIndex].added;
        }

        const trendData = calculateDailyTrend(added, previousAdded);
        trendStr = trendData.trend.padStart(trendWidth);
        color = trendData.color;
      }

      const netColor = net > 0 ? chalk.green : net < 0 ? chalk.red : chalk.gray;

      const commitsStr = String(commits).padStart(commitsWidth);
      const addedStr = String(added).padStart(addedWidth);
      const removedStr = String(removed).padStart(removedWidth);
      const netStr = (net > 0 ? '+' + net : String(net)).padStart(netWidth);

      console.log(
        `${date} ` +
        `${color(trendStr)}  ` +
        `${chalk.magenta(commitsStr)}  ` +
        `${chalk.green(addedStr)}  ` +
        `${chalk.red(removedStr)}  ` +
        `${netColor(netStr)}`
      );
    });

    // Calculate totals
    const totalCommits = dailyData.reduce((sum, d) => sum + d.commits, 0);
    const totalAdded = dailyData.reduce((sum, d) => sum + d.added, 0);
    const totalRemoved = dailyData.reduce((sum, d) => sum + d.removed, 0);
    const totalNet = totalAdded - totalRemoved;

    // Print separator and totals
    console.log(chalk.gray('─'.repeat(11 + trendWidth + commitsWidth + addedWidth + removedWidth + netWidth + 10)));

    const totalNetColor = totalNet > 0 ? chalk.green : totalNet < 0 ? chalk.red : chalk.gray;
    const totalCommitsStr = String(totalCommits).padStart(commitsWidth);
    const totalAddedStr = String(totalAdded).padStart(addedWidth);
    const totalRemovedStr = String(totalRemoved).padStart(removedWidth);
    const totalNetStr = (totalNet > 0 ? '+' + totalNet : String(totalNet)).padStart(netWidth);

    console.log(
      chalk.bold('TOTAL      ') + ' ' +
      ' '.repeat(trendWidth) + '  ' +
      chalk.bold.magenta(totalCommitsStr) + '  ' +
      chalk.bold.green(totalAddedStr) + '  ' +
      chalk.bold.red(totalRemovedStr) + '  ' +
      totalNetColor.bold(totalNetStr)
    );
  }

  // Hourly breakdown
  console.log(chalk.bold('\n=== Hourly Breakdown (Today) ===\n'));

  // Get today's date in target timezone
  const now = new Date();
  let today;
  if (timezone) {
    today = now.toLocaleString('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).split(',')[0];
  } else {
    today = now.toISOString().split('T')[0];
  }

  const hourlyData = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourStr = hour.toString().padStart(2, '0');
    const stats = getStatsForHour(email, hourStr, timezone, today);

    if (stats.added > 0 || stats.removed > 0) {
      hourlyData.push({ hour: hourStr, ...stats });
    }
  }

  if (hourlyData.length === 0) {
    console.log(chalk.gray('No contributions today yet.\n'));
  } else {
    const maxHourAdded = Math.max(...hourlyData.map(h => h.added));
    const maxHourRemoved = Math.max(...hourlyData.map(h => h.removed));
    const hourAddedWidth = Math.max(String(maxHourAdded).length, 5);
    const hourRemovedWidth = Math.max(String(maxHourRemoved).length, 5);

    // Print header
    console.log(
      chalk.gray('Hour ') + ' ' +
      chalk.green('Added'.padStart(hourAddedWidth)) + '  ' +
      chalk.red('Removed'.padStart(hourRemovedWidth))
    );
    console.log(chalk.gray('─'.repeat(5 + hourAddedWidth + hourRemovedWidth + 4)));

    hourlyData.forEach(({ hour, added, removed }) => {
      const addedStr = String(added).padStart(hourAddedWidth);
      const removedStr = String(removed).padStart(hourRemovedWidth);

      console.log(
        `${chalk.cyan(hour + ':00')} ` +
        `${chalk.green(addedStr)}  ` +
        `${chalk.red(removedStr)}`
      );
    });
  }

  console.log('');
}

module.exports = { getContributionStats };

