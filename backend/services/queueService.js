/**
 * Lightweight in-memory FIFO queue for evaluating submissions asynchronously.
 *
 * Why this exists: the HLD doc flags "thousands of users submitting at the same
 * time" (thundering herd) as a core challenge, and says rate limiting is a bad
 * fix -- the right fix is to queue the work and process it asynchronously with
 * bounded concurrency.
 *
 * This implementation is process-local (good enough for one backend instance /
 * local testing). For real multi-instance production scale, swap this out for
 * Redis + BullMQ (same enqueue/consume interface) so the queue survives
 * restarts and can be shared across multiple worker processes -- the rest of
 * the codebase does not need to change, only this file.
 */

const CONCURRENCY = Number(process.env.JUDGE_CONCURRENCY || 2);

class SubmissionQueue {
  constructor() {
    this.queue = [];
    this.activeCount = 0;
  }

  enqueue(job) {
    this.queue.push(job);
    this._drain();
  }

  _drain() {
    while (this.activeCount < CONCURRENCY && this.queue.length > 0) {
      const job = this.queue.shift();
      this.activeCount += 1;
      Promise.resolve()
        .then(job)
        .catch((err) => console.error('[Queue] job failed:', err.message))
        .finally(() => {
          this.activeCount -= 1;
          this._drain();
        });
    }
  }

  size() {
    return { waiting: this.queue.length, active: this.activeCount };
  }
}

module.exports = new SubmissionQueue();
