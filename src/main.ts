import * as core from '@actions/core'
import { context } from '@actions/github'
import { newOctokitInstance } from './internal/octokit.js'

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const githubToken = core.getInput('githubToken', { required: true })
const maxInactivityDays = parseInt(core.getInput('maxInactivityDays', { required: true }))
const bumperFile = core.getInput('bumperFile', { required: true })
const commitMessage = core.getInput('commitMessage', { required: true })
const dryRun = core.getInput('dryRun', { required: true }).toLowerCase() === 'true'

const octokit = newOctokitInstance(githubToken)

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

async function run(): Promise<void> {
    try {
        const millisInDay = 24 * 3600 * 1000
        const minCommitDate = new Date(new Date().getTime() - maxInactivityDays * millisInDay)


        core.debug(`Getting repository commits...`)
        const commits = await octokit.repos.listCommits({
            owner: context.repo.owner,
            repo: context.repo.repo,
            since: minCommitDate.toISOString(),
            per_page: 2,
            page: 1,
        }).then(it => it.data)
        core.debug(`commits = ${JSON.stringify(commits, null, 2)}`)

        if (commits.length) {
            const firstCommit = commits[0]
            core.info(`Skipping bumping repository activity`
                + `, as there is at least one commit since ${minCommitDate.toISOString()}: ${firstCommit.html_url}`,
            )
            return
        }

        core.info(`No commits found commit since ${minCommitDate.toISOString()}, bumping the repository activity`)


        core.debug(`Getting bumper file info...`)
        const bumperFileInfo = await octokit.repos.getContent({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: bumperFile,
        })
            .then(it => it.data)
            .then(it => {
                if (Array.isArray(it)) {
                    return it.length ? it[0] : undefined
                } else {
                    return it
                }
            })
            .catch(error => {
                if (error.status && error.status === 404) {
                    return undefined
                } else {
                    throw error
                }
            })
        core.debug(`bumperFileInfo = ${bumperFileInfo != null ? JSON.stringify(bumperFileInfo, null, 2) : null}`)


        if (dryRun) {
            core.warning(`Skipping bumping repository activity, as dry run is enabled`)
            return
        }


        core.debug(`Updating bumper file...`)
        const commitResult = await octokit.repos.createOrUpdateFileContents({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: bumperFile,
            message: commitMessage,
            content: Buffer.from(new Date().toISOString(), 'utf8').toString('base64'),
            sha: bumperFileInfo?.sha,
        }).then(it => it.data)
        core.debug(`commitResult = ${JSON.stringify(commitResult, null, 2)}`)

        core.info(`Bumper file was updated: ${commitResult.commit.html_url}`)


    } catch (error) {
        core.setFailed(error instanceof Error ? error : `${error}`)
        throw error
    }
}

//noinspection JSIgnoredPromiseFromCall
run()
