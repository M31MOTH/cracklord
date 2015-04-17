cracklord.controller('JobsController', ['$scope', 'JobsService', 'QueueService', 'growl', 'ResourceList', function JobsController($scope, JobsService, QueueService, growl, ResourceList) {
	$scope.listreordered = false;

	$scope.sortableOptions = {
		handle: '.draghandle',
		axis: 'y',
		stop: function(e, ui) {
			$scope.listreordered = true;
		}
	};

	$scope.loadJobs = function() {
		$scope.jobs = JobsService.query(
			//Our success handler
			function(data) {
				$scope.listreordered = false;
				for(var i = 0; i < $scope.jobs.length; i++) {
					if($scope.jobs[i].resourceid) {
						var id = $scope.jobs[i].resourceid;
						var resource = ResourceList.get(id);
						if(resource) {
							$scope.jobs[i].resourcecolor = "background-color: rgb("+resource.color.r+","+resource.color.g+","+resource.color.b+");";
						}
					}
					$scope.jobs[i].starttime = new Date($scope.jobs[i].starttime);
					$scope.jobs[i].expanded = false;
				}

			},
			//Our error handler
			function(error) {
				switch (error.status) {
					case 400: growl.error("You sent bad data, check your input and if it's correct get in touch with us on github"); break;
					case 403: growl.warning("You're not allowed to do that..."); break;
					case 404: growl.error("That object was not found."); break;
					case 409: growl.error("The request could not be completed because there was a conflict with the existing resource."); break;
					case 500: growl.error("An internal server error occured while trying to add the resource."); break;
				}
			}
		);
	}
	$scope.loadJobs();
}]);

cracklord.directive('jobReorderConfirm', ['QueueService', 'growl', function jobReorderConfirm(QueueService, growl) {
	return {
		restrict: 'E',
		templateUrl: 'components/Jobs/jobsReorderConfirm.html', 
		replace: true,
		scope: {
			reload: "&",
			jobs: "=",
			dragstatus: "="
		},
		controller: function($scope) {
			$scope.reorderConfirm = function() {
				var ids = $scope.jobs.map(function (job) {
					if(job) {
						return job.id;
					}
				});

				QueueService.reorder(ids)
					.success(function(data, status, headers, config) {
						growl.success("Job data reordered successfully.");
						$scope.dragstatus = false;
						$scope.reload();
					})
					.error(function(data, status, headers, config) {
						switch (status) {
							case 400: growl.error("You sent bad data, check your input and if it's correct get in touch with us on github"); break;
							case 403: growl.warning("You're not allowed to do that..."); break;
							case 404: growl.error("Somehow the queue object was not found... this is bad."); break;
							case 409: growl.error("The request could not be completed because there was a conflict."); break;
							case 500: growl.error("An internal server error occured while trying to reorder the queue."); break;
						}
						$scope.dragstatus = false;
					});
			}

			$scope.reorderCancel = function() {
				$scope.dragstatus = false;
				$scope.reload();
				growl.info("Reordering of jobs cancelled.")
			}
		}
	}
}]);

cracklord.directive('jobDetail', ['JobsService', 'ToolsService', 'growl', 'ResourceList', function jobDetail(JobsService, ToolsService, growl, ResourceList) {
	return {
		restrict: 'E',
		templateUrl: 'components/Jobs/jobsViewDetail.html',
		scope: {
			jobid: '@',
			visibility: '='
		},
		controller: function($scope) {
			// Mmmmmmmm.... Donut.
			$scope.processDonut = function() {
				$scope.donut = {};
				$scope.donut.labels = ['Processed', 'Remaining'];

				var total = 100 - $scope.detail.progress;
				$scope.donut.data = [$scope.detail.progress, total];

				$scope.donut.colors = [ '#337ab7', '#aaaaaa' ];
			};

			$scope.processLine = function() {
				$scope.line = {};
				$scope.line.series = [ $scope.detail.performancetitle ]; 
				$scope.line.data = [];
				$scope.line.data[0] = [];
				$scope.line.labels = [];
				$scope.line.options = {
					'pointDot': false,
					'showTooltips': false
				};
				$scope.line.colors = [
					'#d43f3a'
				]

				for(var time in $scope.detail.performancedata) {
					$scope.line.data[0].push($scope.detail.performancedata[time]);
					$scope.line.labels.push("");
				}
			}
		},
		link: function($scope, $element, $attrs) {
			$scope.$watch('visibility', function(newval, oldval) {
				if(newval === true) {
					JobsService.get({id: $scope.jobid}, 
						function success(data) {
							ToolsService.get({id: data.job.toolid}, 
								function toolsuccess(data) {
									$scope.tool = data.tool;
								}
							);
							$scope.detail = data.job;

							var resource = ResourceList.get(data.job.resourceid);
							if(resource) {
								$scope.detail.resourcename = resource.name;
							}

							$scope.processDonut();
							$scope.processLine();

							$element.parent().show();
							$element.find('.slider').slideDown();
						},
						function error(error) {
							growl.error("There was a problem loading job details.")
							$($element).find('div.slider').slideUp("slow", function() {
								$element.parent().hide();
							});
						}
					);
				} else {
					$($element).find('div.slider').slideUp("slow", function() {
						$element.parent().hide();
					});
				}
			});
		},
	}
}]);

cracklord.filter('currentJobs', ['JOB_STATUS_RUNNING', 'JOB_STATUS_COMPLETED', function(JOB_STATUS_RUNNING, JOB_STATUS_COMPLETED) {
	return function(items) {
		var filtered = [];
		for (var i = 0; i < items.length; i++) {
			var item = angularjs.copy(items[i]);
			if(JOB_STATUS_RUNNING.indexOf(item.status)) {
				filtered.push(item);
			}
		}
		return filtered;
	};
}]);

cracklord.controller('CreateJobController', ['$scope', '$state', 'ToolsService', 'JobsService', 'growl', function CreateJobController($scope, $state, ToolsService, JobsService, growl) {
	$scope.formData = {};
	$scope.formData.params = {};

	$scope.toolChange = function() {
		var id = $scope.formData.tool.id;
		var tool = ToolsService.get({id: id}, 
			function(data) {
				$scope.tool = data.tool;
			}, 
			function(error) {
				growl.error("An error occured while trying to load tool information.");
			}
		);
	}

	$scope.processNewJobForm = function() {
		var newjob = new JobsService();

		newjob.toolid = $scope.formData.tool.id;
		newjob.name = $scope.formData.name;
		newjob.params = $scope.formData.params;
		
		JobsService.save(newjob, 
			function(data) {
				growl.success("Job successfully added");
				$state.transitionTo('jobs');
			}, 
			function(error) {
				switch (error.status) {
					case 400: growl.error("You sent bad data, check your input and if it's correct get in touch with us on github"); break;
					case 403: growl.warning("You're not allowed to do that..."); break;
					case 404: growl.error("That object was not found."); break;
					case 409: growl.error("The request could not be completed because there was a conflict with the existing resource."); break;
					case 500: growl.error("An internal server error occured while trying to add the resource."); break;
				}
			}
		);
	}	
}]);