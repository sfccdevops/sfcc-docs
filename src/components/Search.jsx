import { createAutocomplete } from '@algolia/autocomplete-core'
import { createLocalStorageRecentSearchesPlugin } from '@algolia/autocomplete-plugin-recent-searches'
import { Dialog } from '@headlessui/react'
import { forwardRef, Fragment, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import clsx from 'clsx'
import Highlighter from 'react-highlight-words'

import { getMeta } from '@/data/meta'

function SearchIcon(props) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" {...props}>
      <path d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z" />
    </svg>
  )
}

const recentSearchesPlugin = createLocalStorageRecentSearchesPlugin({
  key: 'RECENT_SEARCH',
})

function useAutocomplete() {
  let id = useId()
  let router = useRouter()
  let [autocompleteState, setAutocompleteState] = useState({})

  let [autocomplete] = useState(() =>
    createAutocomplete({
      id,
      debug: false,
      plugins: [recentSearchesPlugin],
      placeholder: 'Search SFCC Docs ...',
      openOnFocus: true,
      defaultActiveItemId: 0,
      enterKeyHint: 'search',
      onStateChange({ state }) {
        setAutocompleteState(state)
      },
      onSubmit({ state }) {
        // Don't store recent searches that didn't return any results
        setTimeout(() => {
          recentSearchesPlugin.data.removeItem(state.query)
          autocomplete.refresh()
        }, 10)
      },
      shouldPanelOpen({ state }) {
        return state.query !== ''
      },
      getSources({ query }) {
        return import('@/markdoc/search.mjs').then(({ search }) => {
          return [
            {
              sourceId: 'documentation',
              getItems() {
                return search(query, ['title', 'content'])
              },
              getItemUrl({ item }) {
                return item.url
              },
              onSelect({ item, itemUrl }) {
                const nextId = recentSearchesPlugin.data.getAll().length + 1
                recentSearchesPlugin.data.addItem({
                  url: itemUrl,
                  id: nextId,
                  title: item.title,
                  pageTitle: item.pageTitle,
                  label: query,
                })
                router.push(itemUrl)
              },
            },
          ]
        })
      },
    })
  )

  return { autocomplete, autocompleteState }
}

function LoadingIcon(props) {
  let id = useId()

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <circle cx="10" cy="10" r="5.5" strokeLinejoin="round" />
      <path stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round" d="M15.5 10a5.5 5.5 0 1 0-5.5 5.5" />
      <defs>
        <linearGradient id={id} x1="13" x2="9.5" y1="9" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function HighlightQuery({ text, query }) {
  return <Highlighter highlightClassName="group-aria-selected:underline bg-transparent text-sky-600 dark:text-sky-400" searchWords={query ? query.split(' ') : []} autoEscape={true} textToHighlight={text || ''} />
}

function SearchResult({ result, autocomplete, collection, query, recentResult = false }) {
  let router = useRouter()

  const baseUri = result.url.split('#')[0]
  const deprecated = baseUri.startsWith('/deprecated/')
  const meta = getMeta(baseUri, deprecated)

  const sectionTitle = meta?.nav && meta.nav.alt ? `${meta.nav.alt}` : null
  const hierarchy = meta?.nav ? [meta.nav.parent, meta.nav.child, meta.nav.title].filter(Boolean) : [sectionTitle, result.pageTitle].filter(Boolean)
  const description = meta?.description ? meta.description : null
  const content = result?.content ? result.content : null

  function onRemove(id) {
    recentSearchesPlugin.data.removeItem(id)
    autocomplete.refresh()
  }

  function goToSearchResult(result) {
    const nextId = recentSearchesPlugin.data.getAll().length + 1
    const goToUrl = result.url.replace(/-[0-9]+$/g, '')
    recentSearchesPlugin.data.addItem({
      url: goToUrl,
      id: nextId,
      title: result.title,
      pageTitle: result.pageTitle,
      content: result.content,
      label: query,
    })
    router.push(goToUrl)
  }

  if (hierarchy && description) {
    return (
      <li
        className="group relative block cursor-pointer rounded-lg px-3 py-2 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-700/30"
        aria-label={`Search Result #${result.id}: '${result.title}'`}
        {...autocomplete.getItemProps({
          item: result,
          source: collection.source,
        })}
        role={result.url ? 'button' : 'listitem'}
        onClick={() => {
          if (result.url) {
            if (typeof gtag !== 'undefined') {
              gtag('event', 'Search', {
                event_category: 'Result Click',
                event_label: result.title || '',
                value: result.title?.length || 0,
              })
            }

            goToSearchResult(result)
          }
        }}
      >
        <div id={`title-${result.id}`} aria-hidden="true" className="text-sm text-slate-700 group-aria-selected:text-sky-600 dark:text-slate-300 dark:group-aria-selected:text-sky-400">
          <HighlightQuery text={result.title} query={query} />
        </div>

        {/* Breadcrumb Hierarchy */}
        {hierarchy.length > 0 && (
          <div id={`hierarchy-${result.id}`} aria-hidden="true" className="mt-0.5 truncate whitespace-nowrap text-xs text-slate-700 dark:text-slate-200">
            {hierarchy.map((item, itemIndex, items) => (
              <Fragment key={itemIndex}>
                {item}
                <span className={itemIndex === items.length - 1 ? 'sr-only' : 'mx-2 text-slate-300 dark:text-slate-700'}>/</span>
              </Fragment>
            ))}
          </div>
        )}

        {/* Page Description */}
        {description && (
          <div aria-hidden="true" className="mt-0.5 truncate whitespace-nowrap text-xs text-slate-400 dark:text-slate-400">
            <HighlightQuery text={description} query={query} />
          </div>
        )}

        {/* Search Result content */}
        {content && !content.toLowerCase().replace('\n', ' ').includes(description.toLowerCase().replace('\n', ' ')) && (
          <div aria-hidden="true" className="mt-0.5 truncate whitespace-nowrap text-xs text-slate-400 dark:text-slate-400">
            <HighlightQuery text={content} query={query} />
          </div>
        )}

        {/* Show Recent Results if we have them */}
        {recentResult === true && result.url && (
          <button
            className="absolute right-1 top-1 inline-block h-12 w-12 p-3.5 text-slate-400 transition-colors duration-200 hover:text-red-500 focus:text-red-500 focus:outline-none dark:text-slate-500 dark:hover:text-red-500"
            title="Remove this search"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemove(result.id)
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" role="presentation" className="pointer-events-none">
              <path d="M18 7v13c0 0.276-0.111 0.525-0.293 0.707s-0.431 0.293-0.707 0.293h-10c-0.276 0-0.525-0.111-0.707-0.293s-0.293-0.431-0.293-0.707v-13zM17 5v-1c0-0.828-0.337-1.58-0.879-2.121s-1.293-0.879-2.121-0.879h-4c-0.828 0-1.58 0.337-2.121 0.879s-0.879 1.293-0.879 2.121v1h-4c-0.552 0-1 0.448-1 1s0.448 1 1 1h1v13c0 0.828 0.337 1.58 0.879 2.121s1.293 0.879 2.121 0.879h10c0.828 0 1.58-0.337 2.121-0.879s0.879-1.293 0.879-2.121v-13h1c0.552 0 1-0.448 1-1s-0.448-1-1-1zM9 5v-1c0-0.276 0.111-0.525 0.293-0.707s0.431-0.293 0.707-0.293h4c0.276 0 0.525 0.111 0.707 0.293s0.293 0.431 0.293 0.707v1zM9 11v6c0 0.552 0.448 1 1 1s1-0.448 1-1v-6c0-0.552-0.448-1-1-1s-1 0.448-1 1zM13 11v6c0 0.552 0.448 1 1 1s1-0.448 1-1v-6c0-0.552-0.448-1-1-1s-1 0.448-1 1z" />
            </svg>
          </button>
        )}
      </li>
    )
  } else {
    return null
  }
}

function SearchResults({ autocomplete, query, collection, recentResult = false }) {
  // Remove Duplicate Results
  const ids = collection.items.map(({ pageTitle }) => pageTitle)
  const filtered = collection.items.filter(({ pageTitle, url }, index) => !ids.includes(pageTitle, index + 1))

  const urls = filtered.map(({ url }) => url)
  const unique = filtered.filter(({ url }, index) => {
    const split = url.split('#')
    const baseUri = split[0]
    const hash = split[1] || null

    const hasUrl = urls.includes(baseUri)
    const hasHash = urls.includes(url)

    if (hasUrl && hasHash && hash) {
      return true
    } else if (!hasUrl && hasHash && hash) {
      return true
    } else if (hasUrl && !hasHash) {
      return true
    }

    return false
  })

  // Add IDs to Results
  unique.forEach((result, index) => {
    result.id = index
    result.__autocomplete_id = index
  })

  if (unique.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-700 dark:text-slate-400">
        No results for &ldquo;
        <span className="break-words text-slate-900 dark:text-white">{query}</span>
        &rdquo;
      </p>
    )
  }

  return (
    <ul role="list" {...autocomplete.getListProps()}>
      {unique.map((result) => (
        <SearchResult key={result.id} result={result} autocomplete={autocomplete} collection={collection} query={query} recentResult={recentResult} />
      ))}
    </ul>
  )
}

const SearchInput = forwardRef(function SearchInput({ autocomplete, autocompleteState, onClose, panelRef }, inputRef) {
  let inputProps = autocomplete.getInputProps({})

  return (
    <div className="group relative flex h-12">
      <SearchIcon className="pointer-events-none absolute left-4 top-0 h-full w-5 fill-slate-400 dark:fill-slate-500" />
      <input
        ref={inputRef}
        className={clsx(
          'flex-auto appearance-none bg-transparent pl-12 text-slate-900 outline-none placeholder:text-slate-400 focus:w-full focus:flex-none dark:text-white sm:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden',
          autocompleteState.status === 'stalled' || autocompleteState.status === 'loading' ? 'pr-11' : 'pr-4'
        )}
        {...inputProps}
        onInput={(event) => {
          if (typeof gtag !== 'undefined') {
            gtag('event', 'Search', {
              event_category: 'Input',
              event_label: autocompleteState.query || '',
              value: autocompleteState.query?.length || 0,
            })
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !autocompleteState.isOpen && autocompleteState.query === '') {
            // In Safari, closing the dialog with the escape key can sometimes cause the scroll position to jump to the
            // bottom of the page. This is a workaround for that until we can figure out a proper fix in Headless UI.
            document.activeElement?.blur()
            onClose()
          } else {
            inputProps.onKeyDown(event)
            panelRef.current.scrollTop = 0
          }
        }}
      />
      {(autocompleteState.status === 'stalled' || autocompleteState.status === 'loading') && (
        <div className="absolute inset-y-0 right-3 flex items-center">
          <LoadingIcon className="h-6 w-6 animate-spin stroke-slate-200 text-slate-400 dark:stroke-slate-700 dark:text-slate-500" />
        </div>
      )}
    </div>
  )
})

function SearchDialog({ open, setOpen, className, keyword }) {
  let router = useRouter()
  let formRef = useRef()
  let panelRef = useRef()
  let inputRef = useRef()
  let { autocomplete, autocompleteState } = useAutocomplete()
  let [urlQuery, setUrlQuery] = useState(null)

  useEffect(() => {
    const isHomePage = router.pathname === '/'
    if (!isHomePage) {
      return
    }

    if (router.query.q && router.query.q !== urlQuery) {
      setUrlQuery(router.query.q)
    }

    if (!open && urlQuery) {
      setOpen(true)
      autocomplete.setQuery(urlQuery)
    }

    function goToFirstResult(result) {
      if (result && result.url) {
        const nextId = recentSearchesPlugin.data.getAll().length + 1
        const goToUrl = result.url.replace(/-[0-9]+$/g, '')
        recentSearchesPlugin.data.addItem({
          url: goToUrl,
          id: nextId,
          title: result.title,
          pageTitle: result.pageTitle,
          label: urlQuery,
        })

        window.location.replace(goToUrl)
      }
    }

    if (open && urlQuery && autocompleteState && autocompleteState.query === urlQuery && autocompleteState.collections.length > 0) {
      goToFirstResult(autocompleteState.collections[0].items[0])
      return
    }
  }, [router, urlQuery, setUrlQuery, open, setOpen, autocomplete, autocompleteState])

  useEffect(() => {
    if (!open) {
      return
    }

    function onRouteChange() {
      setOpen(false)
    }

    router.events.on('routeChangeStart', onRouteChange)
    router.events.on('hashChangeStart', onRouteChange)

    return () => {
      router.events.off('routeChangeStart', onRouteChange)
      router.events.off('hashChangeStart', onRouteChange)
    }
  }, [open, setOpen, router])

  useEffect(() => {
    if (open) {
      return
    }

    function onKeyDown(event) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false)
        autocomplete.setQuery('')
      }}
      className={clsx('fixed inset-0 z-40', className)}
    >
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur" />

      <div className="fixed inset-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-20 md:py-32 lg:px-8 lg:py-[15vh]">
        <Dialog.Panel className="mx-auto transform-gpu overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800 dark:ring-1 dark:ring-slate-700 sm:max-w-xl">
          <div {...autocomplete.getRootProps({})}>
            <form
              ref={formRef}
              {...autocomplete.getFormProps({
                inputElement: inputRef.current,
              })}
            >
              <SearchInput ref={inputRef} panelRef={panelRef} autocomplete={autocomplete} autocompleteState={autocompleteState} onClose={() => setOpen(false)} />
              <div ref={panelRef} className="max-h-96 overflow-scroll border-t border-slate-200 bg-white px-2 py-3 empty:hidden dark:border-slate-400/10 dark:bg-slate-800" {...autocomplete.getPanelProps({})}>
                {autocompleteState.isOpen &&
                  autocompleteState.collections?.map((collection, index) => {
                    const { source } = collection
                    if (source.sourceId === 'documentation') {
                      return <SearchResults key={index} autocomplete={autocomplete} query={autocompleteState.query} collection={collection} recentResult={false} />
                    }
                  })}
                {!autocompleteState.isOpen &&
                  autocompleteState.collections?.map((collection, index) => {
                    const { source } = collection
                    if (source.sourceId === 'recentSearchesPlugin') {
                      return (
                        <div key={index}>
                          <span className="mb-1 block text-center text-xs uppercase text-slate-700 dark:text-slate-400">Recent Searches</span>
                          <SearchResults autocomplete={autocomplete} query={autocompleteState.query} collection={collection} recentResult={true} />
                        </div>
                      )
                    }
                  })}
              </div>
            </form>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

function useSearchProps() {
  let buttonRef = useRef()
  let [open, setOpen] = useState(false)

  return {
    buttonProps: {
      ref: buttonRef,
      onClick() {
        setOpen(true)
      },
    },
    dialogProps: {
      open,
      setOpen(open) {
        let { width, height } = buttonRef.current.getBoundingClientRect()
        if (!open || (width !== 0 && height !== 0)) {
          setOpen(open)
        }
      },
    },
  }
}

export function Search() {
  let [modifierKey, setModifierKey] = useState()
  let { buttonProps, dialogProps } = useSearchProps()

  useEffect(() => {
    setModifierKey(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? '⌘' : 'Ctrl ')
  }, [])

  return (
    <>
      <button
        type="button"
        className="group flex h-6 w-6 items-center justify-center sm:justify-start md:h-auto md:w-80 md:flex-none md:rounded-lg md:py-2.5 md:pl-4 md:pr-3.5 md:text-sm md:ring-1 md:ring-slate-200 md:hover:ring-slate-300 dark:md:bg-slate-800/75 dark:md:ring-inset dark:md:ring-white/5 dark:md:hover:bg-slate-700/40 dark:md:hover:ring-slate-500 lg:w-96"
        {...buttonProps}
      >
        <SearchIcon className="h-5 w-5 flex-none fill-slate-400 group-hover:fill-slate-500 dark:fill-slate-500 md:group-hover:fill-slate-400" />
        <span className="sr-only md:not-sr-only md:ml-2 md:text-slate-500 md:dark:text-slate-400">Search SFCC Docs ...</span>
        {modifierKey && (
          <kbd className="ml-auto hidden font-medium text-slate-400 dark:text-slate-500 md:block">
            <kbd className="font-sans">{modifierKey}</kbd>
            <kbd className="font-sans">K</kbd>
          </kbd>
        )}
      </button>
      <SearchDialog {...dialogProps} />
    </>
  )
}
