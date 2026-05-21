# Ideas

## GHCR visualizer

To my knowledge no tool exists, which nicely shows the graphs in a GitHub image registry package (GHCR).

And ghcr-manager has a nice DB with full data of one or several GHCR.

And it's really hard to mentally visualize even one group in a GHCR. I picture my `single` test setup with:

- amd64 and arm64 images
- a cross-platform manifest
- provenance and cosign signature for the 3 above
- together with some wrapper manifests from cosign => 17 manifests total in a graph, not a tree
- By looking at the data in the DB, I can mentally see parts of this graph, but not picture the full graph of 17
  manifests without quite some manual data preparation and arranging

### Visualize idea

I only briefly discussed with ChatGPT and there [Cytoscape.js](https://github.com/cytoscape/cytoscape.js#cytoscapejs)
seemed to be a clear candidate for this.

I imagine visualizing such charts in a GHCR in a browser, driven by ghcr-manager (or maybe a separate tool using
ghcr-manager DBs). It does not have to be pretty at start - and I am a command line designer and unlikely to make it
pretty - but functional at first.

Should show at least graphs of manifests with tags and some (untrusted `manifest_kind) label what it probably is.  
Then maybe something like see JSON on click or such.

## Show actual deleted manifests (images) in JSON and count in summary table

`dataaxiom/ghcr-cleanup-action` calls them "deleted images". I am not sure if all those manifests are images though -
technically. In any case we should consider listing distinct deleted (or simulated in dry-run) manifest digests, maybe
even attach them to the root manifest which triggers their deletion (distinct reduces data though).

In my tests it seemed this can be achieved by looking at entries in `cleanup_root_decisions` which are to be deleted and
one simple join to `manifest_reachability` like in

```sql
select      distinct manifest_reachability.descendant_digest
from        cleanup_root_decisions
            inner join
            manifest_reachability
            on  manifest_reachability.scan_id = cleanup_root_decisions.scan_id
                and manifest_reachability.ancestor_digest = cleanup_root_decisions.digest
```

Which brings me to my next idea/issue:

## Document and sanitize string values in `cleanup_root_decisions`

When looking at a DB after a `cleanup` command (or one with dry-run), the table `cleanup_root_decisions` is full of
string codes which leave even me guessing what they exactly mean.

I want those string codes polished:

- wording: discuss their value and if they say what they do and if that is clear to users
- harden them with solid enum/DB-sonstraint and such
- document them to users, cleanly. if even I can't make sense of those codes, how shall they?

At the moment I am not even sure if that table has the right shape. we delete by tag (mostly, digest also possible)
and while the cleanup documents what root manifests get deleted/touched - it's not clear what (tag-)filter item selected
them. Here I am thinking about adding a `cleanup_tag` table or such - holding selected tags with an FK to
`cleanup_root_decisions` (which might change in shape).

If my earlier reading that joining `cleanup_root_decisions` to `manifest_reachability` gives deleted manifests, then
this idea would show the other side clearly - why a root manifest was picked.
