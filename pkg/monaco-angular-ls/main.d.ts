/**
 * Patches the typescript and html service to support Angular language features.
 * @returns A function that reverts all changes made to monaco by the plugin.
 */
declare function setupAngularWorker(): () => void;
export default setupAngularWorker;