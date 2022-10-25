/**
 * A configuration on how to rewrite Collection Paths
 */
interface PathRewrite {
  /**
   * RegExp to search for
   */
  regex: RegExp
  /**
   * Replacement string
   */
  replace: string
}
