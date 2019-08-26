import * as AWS from "aws-sdk";
import * as test from "tape";

import { IImage, IIndex, IPerson, IQueryBody } from "../../fotos/types";
import { createIndexAdjustment } from "./createIndexAdjustment";
import formatError from "./formatError";
import getEndpointPath from "./getEndpointPath";

export default function deleteAllNotJustTestData(setupData, api) {
  let images: IImage[];
  test("query all to get all images", (t) => {
    const query: IQueryBody = {
      criteria: {
        people: [],
        tags: [],
      },
      from: 0,
      to: Date.now(),
    };

    api.post(setupData.apiUrl, "/query", {
      body: query,
    })
      .then((responseBody: IImage[]) => {
        if (Array.isArray(responseBody)) {
          t.ok(Array.isArray(responseBody), "query response is an array");
          t.ok(responseBody, `queried all and found ${responseBody.length} images`);
          images = responseBody;
          t.end();
        } else {
          t.notOk(Array.isArray(responseBody), "query response is a string - no results");
          images = [];
          t.end();
        }
      })
      .catch(formatError);
  });
  let existingIndexes: IIndex;
  test("get existing indexes", (t) => {
    api
      .get(setupData.apiUrl, "/indexes")
      .then((responseBody: IIndex) => {
        t.ok(responseBody, "Indexes retrieved");
        existingIndexes = responseBody;
        t.end();
      })
      .catch(formatError);
  });

  let existingPeople: IPerson[];
  test("get existing people", (t) => {
    api
      .get(setupData.apiUrl, "/people")
      .then((responseBody: IPerson[]) => {
        t.ok(responseBody, "Existing people retrieved");
        existingPeople = responseBody;
        t.end();
      })
      .catch(formatError);
  });

  let deleteImages: IImage[];
  test("delete all images in the env!!!", (t) => {
    deleteImages = images;

    if (deleteImages.length > 0) {
      Promise.all(deleteImages.map((img) => {
        const apiPath = getEndpointPath(img);
        return api.del(setupData.apiUrl, apiPath);
      }))
        .then((responseBodies) => {
          t.equal(
            responseBodies.length,
            deleteImages.length,
            `resolved promises same length as delete images (${deleteImages.length})`);
          t.end();
        })
        .catch(formatError);
    } else {
      t.end();
    }
  });

  test("query all should return no results matching test data", (t) => {
    const query: IQueryBody = {
      criteria: {
        people: [],
        tags: [],
      },
      from: 0,
      to: Date.now(),
    };

    api.post(setupData.apiUrl, "/query", {
      body: query,
    })
      .then((responseBody) => {
        if (Array.isArray(responseBody)) {
          const matchingResults = responseBody.filter((img) => {
            return setupData.records.includes((rec) => rec.img_key === img.img_key);
          });
          t.equal(matchingResults.length, 0, "No results match test images");
        } else {
          const resultAsString = Array.isArray(responseBody) ? "" : responseBody;
          t.ok(resultAsString.includes("No items found"));
        }
        t.end();
      })
      .catch(formatError);
  });

  test("get people should return no results with the deleted test image ids", (t) => {
    // const peopleToCheck = images.reduce((accum, img) =>
    //   Array.isArray(img.people) ? accum.concat(img.people) : accum,
    // [] as string[]);
    const imageIds =  deleteImages.map((img) => img.id);
    api
      .get(setupData.apiUrl, "/people")
      .then((responseBody: IPerson[]) => {
        const peopleWithDeletedImageIds = responseBody.filter((p) => {
          const facesWithDeletedImageId = p.faces.filter(
            (f) => f.ExternalImageId && imageIds.includes(f.ExternalImageId),
          );
          return facesWithDeletedImageId.length > 0;
        });
        t.equal(
          peopleWithDeletedImageIds.length,
          0,
          `all deleted images (${
            imageIds.toString()
          }) have been removed from people ${
            peopleWithDeletedImageIds.map((p) => p.id).toString()
          }`,
        );
        t.end();
      })
      .catch(formatError);
  });

  test("get indexes should return an index object with adjusted counts matching deleted test images", (t) => {
    const testImagesPeople = deleteImages.reduce((accum, img) => accum.concat(img.people!), [] as string[]);
    const testImagesTags = deleteImages.reduce((accum, img) => accum.concat(img.tags!), [] as string[]);

    const indexAdjustments = {
      people: createIndexAdjustment(testImagesPeople),
      tags: createIndexAdjustment(testImagesTags),
    };
    api
      .get(setupData.apiUrl, "/indexes")
      .then((responseBody: IIndex) => {
        const incorrectAdjustmentTags = Object.keys(indexAdjustments.tags)
          .filter((tag) => responseBody.tags[tag] !==  existingIndexes.tags[tag] + indexAdjustments.tags[tag]);
        t.equal(
          incorrectAdjustmentTags.length,
          0,
          `all tags adjustments are correct. Checked ${Object.keys(indexAdjustments.tags).length} adjustments`,
        );
        const incorrectAdjustmentPeople = Object.keys(indexAdjustments.people)
          .filter((p) => responseBody.people[p] !==  existingIndexes.people[p] + indexAdjustments.people[p]);
        t.equal(
          incorrectAdjustmentPeople.length,
          0,
          `all people adjustments are correct. Checked ${Object.keys(indexAdjustments.people).length} adjustments`,
        );
        t.end();
      })
      .catch(formatError);
  });

  test("Update people to be an empty array", (t) => {
    const people: IPerson[] = [];
    const body = {
      people,
    };
    api
      .put(setupData.apiUrl, "/people/update", {
        body,
      })
      .then((responseBody) => {
        t.ok(responseBody, "people updated to [] ok");
        t.end();
      })
      .catch(formatError);
  });

  let rekognitionFaceIds;

  AWS.config.update({region: "us-east-1"});
  const rekognition = new AWS.Rekognition();

  test("Get the rekognition faces", (t) => {
    // tslint:disable-next-line:no-console
    console.log("region", process.env.AWS_REGION);
    const params = {
      CollectionId: setupData.collectionId,
    };
    rekognition.listFaces(params).promise()
      .then((faces) => {
        t.ok(faces, `Faces retrieved from collection ${setupData.collectionId}`);
        rekognitionFaceIds = faces!.Faces!.map((f) => f.FaceId);
        t.ok(rekognitionFaceIds, `Faces mapped: ${rekognitionFaceIds.length}`);
        t.end();
      })
      .catch(formatError);

  });

  test("Delete faces in the rekognition collection", (t) => {
    const params = {
      CollectionId: "myphotos",
      FaceIds: rekognitionFaceIds,
    };
    rekognition.deleteFaces(params).promise()
      .then((faces) => {
        t.ok(faces, `Faces deleted from collection ${setupData.collectionId}`);
        const deletedFaces = faces!.DeletedFaces!;
        t.deepEqual(deletedFaces, rekognitionFaceIds, `Faces deleted are same as list retrieved`);
        t.end();
      })
      .catch(formatError);
  });

  test("Update indexes to be an empty IIndex", (t) => {
    const index: IIndex = {
      people: {},
      tags: {},
    };
    const body = {
      index,
    };
    api
      .put(setupData.apiUrl, "/indexes/update", {
        body,
      })
      .then((responseBody) => {
        t.ok(responseBody, "index updated to empty obj ok");
        t.end();
      })
      .catch(formatError);
  });
}
