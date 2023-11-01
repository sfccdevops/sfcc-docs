import { getMeta } from '@/data/meta'

export default function handler(req, res) {
  // Load Search Function
  import('@/markdoc/search.mjs').then(({ search }) => {
    try {
      // Perform Search
      const baseURL = process.env.SITE_URL || 'https://sfccdocs.com'
      const results = search(req.query.query, {
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      })

      // Loop through results
      results.map((result, index) => {
        // Add additional properties
        const parts = result.url.split('#')
        const baseUri = parts[0]
        const anchor = parts.length > 1 ? `#${parts[1]}` : ''
        const deprecated = baseUri.startsWith('/deprecated/')
        const meta = getMeta(baseUri, deprecated)

        result.deprecated = deprecated
        result.title = meta.title
        result.description = meta.description
        result.keywords = meta.nav.alt.split(' › ')
        result.snippet = result.snippet.split('. ')[0]
        result.url = `${baseURL}${result.url}`
        result.embed = `${baseURL}${baseUri}?embed=true${anchor}`

        // Remove unneeded properties
        delete result.score

        if (result.pageTitle) {
          delete result.pageTitle
        }

        // Sort properties alphabetically for easier readability
        results[index] = Object.keys(result)
          .sort()
          .reduce((accumulator, key) => {
            accumulator[key] = result[key]

            return accumulator
          }, {})
      })

      // Return results
      res.status(200).json({ total: results.length, results })
    } catch (error) {
      // Return error
      res.status(400).json({ error: error.message })
    }
  })
}