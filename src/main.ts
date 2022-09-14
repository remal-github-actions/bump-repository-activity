import * as core from '@actions/core'
import {context} from '@actions/github'
import {newOctokitInstance} from './internal/octokit'

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const githubToken = core.getInput('githubToken', {required: true})
const bumperFile = core.getInput('bumperFile', {required: true})
const commitMessage = core.getInput('commitMessage', {required: true})
const dryRun = core.getInput('dryRun', {required: true}).toLowerCase() === 'true'

const octokit = newOctokitInstance(githubToken)

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

async function run(): Promise<void> {
    try {
        const millisInDay = 24 * 3600 * 1000
        const minCommitDate = new Date(new Date().getTime() + 14 * millisInDay + (Math.random() * 14 * millisInDay))


        const commits = await octokit.repos.listCommits({
            owner: context.repo.owner,
            repo: context.repo.repo,
            since: minCommitDate.toISOString(),
            per_page: 5,
            page: 1,
        }).then(it => it.data)

        if (commits.length) {
            core.info(`There is at least one commit since ${minCommitDate}: ${commits[0].html_url}`)
            return
        }

        core.info(`No commits found commit since ${minCommitDate}`)


        if (dryRun) {
            core.warning(`Skipping bumping repository activity, as dry run is enabled`)
            return
        }


        const commitResult = await octokit.repos.createOrUpdateFileContents({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: bumperFile,
            message: commitMessage,
            content: Buffer.from(new Date().toString(), 'utf8').toString('base64'),
        }).then(it => it.data)

        core.info(`Bumper file was updated: ${commitResult.commit.html_url}`)


    } catch (error) {
        core.setFailed(error instanceof Error ? error : (error as object).toString())
        throw error
    }
}

//noinspection JSIgnoredPromiseFromCall
run()

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function parseDate(value: string | undefined | null): Date | undefined {
    if (value == null) {
        return undefined
    }

    return new Date(value)
}
