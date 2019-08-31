import { DynamoDBRecord } from "aws-lambda";
import * as test from "tape";
import * as indexes from "./indexes";
import { getIndexUpdates } from "./stream";
import { IIndex, IIndexUpdate } from "./types";

test("removeZeroCounts ", (t) => {
  const index: IIndex = {
    people: {
      emma: 1,
      leona: 1,
      wilma: 2,
    },
    tags: {
      black: 0,
      pink: 2,
      yellow: 1,
    },
  };
  const result = indexes.removeZeroCounts(index);
  t.equal(result.tags.black, undefined, "0 index has been removed");
  t.end();
});

test("calculateUpdatedIndex - negative values", (t) => {
  const existing: IIndex = {
    people: {
      barack: 1,
    },
    tags: {
      yellow: 2,
    },
  };
  const updates: IIndexUpdate = {
    people: {
      barack: -1,
      fred: 2,
    },
    tags: {
      yellow: -2,
    },
  };
  const result = indexes.calculateUpdatedIndex(existing, updates);
  t.deepEqual(result, {
    people: {
      barack: 0,
      fred: 2,
    },
    tags: {
      yellow: 0,
    },
  });

  t.end();
});

test("calculateUpdatedIndex - no existing index", (t) => {
  const errorIndex: IIndex = {
    error: true,
    people: {},
    tags: {},
  };
  const updates: IIndexUpdate = {
    people: {
      emma: 1,
      leona: 1,
      wilma: 2,
    },
    tags: {
      black: 0,
      pink: 2,
      yellow: 1,
    },
  };
  const result = indexes.calculateUpdatedIndex(errorIndex, updates);
  t.deepEqual(result, {
    people: {
      emma: 1,
      leona: 1,
      wilma: 2,
    },
    tags: {
      black: 0,
      pink: 2,
      yellow: 1,
    },
  });
  t.end();
});

test("getUpdatedIndexes - modifies existing index with just tags", (t) => {
  const existing: IIndex = {
    people: {},
    tags: {
      black: 4,
      green: 7,
      yellow: 1,
    },
  };
  const updates: IIndexUpdate = {
    people: {
      emma: 1,
      leona: 1,
      wilma: 2,
    },
    tags: {
      black: -1,
      pink: 2,
      yellow: 1,
    },
  };
  const result = indexes.calculateUpdatedIndex(existing, updates);
  t.deepEqual(result, {
    people: {
      emma: 1,
      leona: 1,
      wilma: 2,
    },
    tags: {
      black: 3,
      green: 7,
      pink: 2,
      yellow: 2,
    },
  });
  t.end();
});

test("get image records indexes", (t) => {
  const recordsRaw: DynamoDBRecord[] = [
    {
      awsRegion: "us-east-1",
      dynamodb: {
        ApproximateCreationDateTime: 1566962110,
        Keys: {
          id: { S: "9b1d5700-c8c3-11e9-bf5e-ab9eba55ceea" },
          username: { S: "tester" },
        },
        OldImage: {
          birthtime: { N: "1563448223924" },
          createdAt: { N: "1566907807784" },
          group: { S: "sosnowski-roberts-alpha" },
          id: { S: "9b1d5700-c8c3-11e9-bf5e-ab9eba55ceea" },
          img_key: { S: "tester/steve.jpg" },
          img_thumb_key: { S: "tester/steve-thumbnail.jpg" },
          meta: { M: { height: { N: "1448" }, width: { N: "1488" } } },
          people: { L: [{ S: "9ca94e30-c8c3-11e9-a794-7524c255cd6f" }] },
          tags: {
            L: [
              { S: "Human" },
              { S: "Person" },
              { S: "Glasses" },
              { S: "Accessories" },
              { S: "Accessory" },
              { S: "Apparel" },
              { S: "Clothing" },
              { S: "Coat" },
              { S: "Suit" },
              { S: "Overcoat" },
            ],
          },
          traceMeta: {
            M: {
              parentId: { S: "03a4d4b0-c8c4-11e9-aa07-0d71283ce829" },
              traceId: { S: "03a4d4b1-c8c4-11e9-aa07-0d71283ce829" },
            },
          },
          updatedAt: { N: "1566907982467" },
          userIdentityId: {
            S: "us-east-1:e2824167-1682-4bdb-a285-f91e97e4cb03",
          },
          username: { S: "tester" },
        },
        SequenceNumber: "35734900000000002324267854",
        SizeBytes: 1778,
        StreamViewType: "NEW_AND_OLD_IMAGES",
      },
      eventID: "560a1933c812726f38fec9f05158b2b3",
      eventName: "REMOVE",
      eventSource: "aws:dynamodb",
      eventSourceARN:
        "arn:aws:dynamodb:us-east-1:366399188066:table/fotopia-web-app-alpha/stream/2019-08-20T12:25:36.318",
      eventVersion: "1.1",
    },
  ];
  const existingIndex: IIndex = {
    people: {
      "9ca94e30-c8c3-11e9-a794-7524c255cd6f": 1,
    },
    tags: {
      Accessories : 1,
      Accessory : 1,
      Apparel : 1,
      Clothing: 1,
      Coat: 1,
      Glasses: 1,
      Human: 1,
      Overcoat: 1,
      Person: 1,
      Suit: 1,
    },
  };
  const updates: IIndexUpdate = getIndexUpdates(recordsRaw);

  const result = indexes.calculateUpdatedIndex(existingIndex, updates);
  t.deepEqual(result, {
    people: {
      "9ca94e30-c8c3-11e9-a794-7524c255cd6f": 0,
    },
    tags: {
      Accessories : 0,
      Accessory : 0,
      Apparel : 0,
      Clothing: 0,
      Coat: 0,
      Glasses: 0,
      Human: 0,
      Overcoat: 0,
      Person: 0,
      Suit: 0,
    },
  });
  t.end();
});

test("getModifiedIndexItems", (t) => {
  const existing: IIndex = {
    people: {
      "9ca94e30-c8c3-11e9-a794-7524c255cd6f": 1,
    },
    tags: {
      Accessories : 1,
      Accessory : 1,
      Apparel : 1,
      Clothing: 1,
      Coat: 1,
      Glasses: 1,
      Human: 1,
      Overcoat: 1,
      Person: 1,
      Suit: 1,
    },
  };
  const updated: IIndex = {
    people: {
      "9ca94e30-c8c3-11e9-a794-7524c255cd6f": 0,
    },
    tags: {
      Accessories : 0,
      Accessory : 0,
      Apparel : 0,
      Clothing: 0,
      Coat: 0,
      Glasses: 0,
      Human: 2,
      Overcoat: 0,
      Person: 1,
      Suit: 1,
    },
  };

  const resultPeople = indexes.getModifiedIndexItems(existing.people, updated.people);
  const resultTags = indexes.getModifiedIndexItems(existing.tags, updated.tags);

  t.equal(resultPeople.length, 1, `${resultPeople.length} modified people`);
  t.equal(resultTags.length, 8, `${resultTags.length} modified tags`);
  t.end();

});
