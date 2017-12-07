'use strict';
var app = require('../../server/server');
module.exports = function (School) {
  School.validatesPresenceOf(
    'instituteId',
    'schoolName',
    'schoolCode',
    'schoolHeader'
  );

  School.observe('before save', function (ctx, next) {
    if (ctx.isNewInstance) {
      ctx.instance.invoiceSequenceNumber = 0;
      next();
    }
    else {
      var itemId = ctx.data.id != undefined ? ctx.data.id : ctx.where.id;
      School.findById(itemId, function (err, _savedSchool) {
        if (_savedSchool.invoiceMnemonic != ctx.data.invoiceMnemonic) {
          ctx.data.invoiceSequenceNumber = 0;
        }
        next();
      });
    }
  });

  School.observe('after save', function (ctx, next) {
    if (ctx.isNewInstance) {
      app.models.container.createContainer({
        "name": ctx.instance.id.toString()
      }, function (err, container) {
        if (err) {
          return next(err);
        } else {
          var _userSchoolDetails = {
            "userId": ctx.options.accessToken.userId,
            "schoolId": ctx.instance.id
          };
          app.models.Userschooldetails.create(_userSchoolDetails, function (err, schoolMapping) {
            if (err) return next(err);
            next();
          });

        }
      });
    } else {
      next();
    }
  });

  School.getInvoices = function (schoolId, filter, options, cb) {
    app.models.Student.find({ where: { schoolId: schoolId } }, function (err, _students) {
      if (err) cb(err);
      else {
        if (_students.length > 0) {
          var searchCondition = _students.map(function (s, i) {
            return { studentId: s.id };
          });
          if (filter && filter.where) {
            filter.where = {
              and: [
                { or: searchCondition },
                filter.where
              ]
            }
          }
          else {
            if (filter == undefined)
              filter = {};
            filter.where = { or: searchCondition };
          }
          filter.include = ["invoiceDetails", "studentData"];
          // app.models.Invoice.find({ where: { or: searchCondition }, include: ["invoiceDetails", "studentData"] }, function (err, _invoices) {
          app.models.Invoice.find(filter, function (err, _invoices) {
            if (err) cb(err);
            else {
              cb(null, _invoices);
            }
          });
        }
        else {
          cb(null, []);
        }
      }
    });
  }

  School.remoteMethod('getInvoices', {
    accepts: [
      {
        arg: 'schoolId',
        type: 'Number'
      },
      {
        arg: 'filter',
        type: 'object',
        'http': { source: 'query' }
      },
      {
        arg: "options",
        type: "object",
        http: "optionsFromRequest"
      }],
    http: { path: '/:schoolId/SchoolInvoices/', verb: 'get' },
    returns: { arg: '_students', type: 'Invoice' }
  });

};
