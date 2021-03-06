import * as test from "tape";
import * as indexes from "./indexes";
import { IIndexDictionary } from "./types";

import {
  DocumentClient as DocClient,
} from "aws-sdk/lib/dynamodb/document_client.d";

test("parseIndexesObject ", (t) => {

  process.env.DYNAMODB_TABLE_INDEXES = "TABLE";
  const batchGetItemOutput: DocClient.BatchGetItemOutput = {
    Responses: {
      [process.env.DYNAMODB_TABLE_INDEXES]: [{
        id: indexes.TAGS_ID,
        [indexes.INDEX_KEYS_PROP]: {
          black: 0,
          pink: 2,
          yellow: 1,
        },
      }, {
        id: indexes.PEOPLE_ID,
        [indexes.INDEX_KEYS_PROP]: {
          emma: 1,
          leona: 1,
          wilma: 2,
        },
      }],
    },
  };
  const result = indexes.parseIndexesObject(batchGetItemOutput);
  t.equal(result.tags.black, 0, "tag parsed to index shape");
  t.equal(result.people.leona, 1, "person parsed to index shape");
  t.end();
});

test("getDynamoDbUpdateItemParams", (t) => {
  const tags: IIndexDictionary = {
    yellow: -2,
  };
  const result = indexes.getDynamoDbUpdateItemParams(tags, indexes.TAGS_ID, ["yellow"]) as DocClient.UpdateItemInput;
  t.deepEqual(result.ExpressionAttributeNames, { "#0": `yellow`, "#indexKeysProp": indexes.INDEX_KEYS_PROP });
  t.equal(result.ExpressionAttributeValues![":0"], tags.yellow);
  t.deepEqual(result.Key, { id: "tags" });
  t.end();
});

test("getDynamoDbUpdateItemParamsBatch", (t) => {
  const tags: IIndexDictionary = {
    yellow: -2,
    a: -1,
    b: -1,
    c: -1,
    d: -1,
    e: -1,
    f: -1,
    g: -1,
    h: -1,
    i: -1,
    j: -1,
    k: -1,
  };
  const result = indexes.getDynamoDbUpdateItemParamsBatch(indexes.TAGS_ID, tags) as DocClient.UpdateItemInput[];
  t.equal(result.length, 2, "two batches");
  t.end();
});
