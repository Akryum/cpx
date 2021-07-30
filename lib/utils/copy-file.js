/* eslint-disable no-process-env */

/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

const path = require("path")
const fs = require("fs-extra")

const excludeReg = process.env.CPX_EXCLUDE
    ? new RegExp(process.env.CPX_EXCLUDE)
    : null

/**
 * Copy the content of the given file.
 * Transform the content by 'transform' option.
 * @param {string} source - A path of the source file.
 * @param {string} output - A path of the destination file.
 * @param {function[]} transforms - Factory functions for transform streams.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 * @private
 */
async function copyFileContent(source, output, transforms) {
    if (excludeReg && excludeReg.test(source)) {
        return
    }

    // Skip change if content is equal
    let sourceContent = fs.readFileSync(source)
    if (fs.existsSync(output)) {
        const outputContent = fs.readFileSync(output)
        if (Buffer.compare(sourceContent, outputContent) === 0) {
            return
        }
    }

    sourceContent = transforms.reduce((content, t) => t(content), sourceContent)

    await fs.writeFile(output, sourceContent)
}

/**
 * Copy a file asynchronously.
 * Additionally, copy file attributes also by options.
 * @function
 * @param {string} source - A path of the source file.
 * @param {string} output - A path of the destination file.
 * @param {object} options - Options.
 * @param {function[]} options.transform - Factory functions for transform streams.
 * @param {boolean} options.preserve - The flag to copy attributes.
 * @param {boolean} options.update - The flag to disallow overwriting.
 * @returns {Promise<void>} The promise which will go fulfilled after done.
 * @private
 */
module.exports = async function copyFile(source, output, options) {
    const stat = await fs.stat(source)

    if (options.update) {
        try {
            const dstStat = await fs.stat(output)
            if (dstStat.mtime.getTime() > stat.mtime.getTime()) {
                // Don't overwrite because the file on destination is newer than
                // the source file.
                return
            }
        } catch (dstStatError) {
            if (dstStatError.code !== "ENOENT") {
                throw dstStatError
            }
        }
    }

    if (stat.isDirectory()) {
        await fs.ensureDir(output)
    } else {
        await fs.ensureDir(path.dirname(output))
        await copyFileContent(source, output, options.transform)
    }
    await fs.chmod(output, stat.mode)

    if (options.preserve) {
        await fs.chown(output, stat.uid, stat.gid)
        await fs.utimes(output, stat.atime, stat.mtime)
    }
}
